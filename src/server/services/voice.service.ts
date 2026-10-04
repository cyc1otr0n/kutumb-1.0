import { ObjectId } from "mongodb";
import { collections } from "../db/client";
import type { VoiceUpdateDoc } from "../db/types";
import type { AuthContext } from "../context";
import { executeKutumbQuery } from "../agent/kutumb.agent";
import { logActivity } from "./family.service";
import type { VoiceResponseDTO } from "@/lib/types";
import { env } from "../env";

export async function transcribeAudioWithElevenLabs(
  audioBase64: string,
  mimeType = "audio/webm"
): Promise<string> {
  const apiKey = env.elevenLabsApiKey();
  if (!apiKey) {
    throw new Error("ElevenLabs API key is not configured");
  }

  const cleanBase64 = audioBase64.replace(/^data:[^,]+,/, "").trim();
  const audioBuffer = Buffer.from(cleanBase64, "base64");
  const ext = mimeType.includes("wav") ? "wav" : mimeType.includes("mp4") ? "mp4" : "webm";
  const fileMime = mimeType.split(";")[0].trim() || "audio/webm";
  const filename = `recording.${ext}`;

  // Build raw multipart/form-data body manually (Node.js doesn't support FormData.append with a Buffer filename)
  const boundary = `kutumb_${Date.now()}`;
  const CRLF = "\r\n";

  const header = Buffer.from(
    `--${boundary}${CRLF}` +
    `Content-Disposition: form-data; name="model_id"${CRLF}${CRLF}` +
    `scribe_v1${CRLF}` +
    `--${boundary}${CRLF}` +
    `Content-Disposition: form-data; name="file"; filename="${filename}"${CRLF}` +
    `Content-Type: ${fileMime}${CRLF}${CRLF}`
  );
  const footer = Buffer.from(`${CRLF}--${boundary}--${CRLF}`);
  const body = Buffer.concat([header, audioBuffer, footer]);

  const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
    },
    body,
    signal: AbortSignal.timeout(20000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`ElevenLabs STT error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  // Filter out audio event tags like [beep], [music] - only return spoken words
  const rawText = (data.text || "").trim();
  const cleanText = rawText.replace(/\[[^\]]*\]/g, "").trim();
  return cleanText;
}

export async function transcribeAudioWithGoogle(
  audioBase64: string,
  mimeType = "audio/webm"
): Promise<string> {
  const apiKey = env.googleApiKey();
  if (!apiKey) {
    throw new Error("Google Generative AI API key is not configured for voice transcription");
  }

  // Strip any data URI prefix (e.g. data:audio/webm;codecs=opus;base64, or data:audio/wav;base64,)
  const cleanBase64 = audioBase64.replace(/^data:[^,]+,/, "").trim();

  // If mimeType wasn't explicitly set, try to infer from data URI
  if (audioBase64.startsWith("data:")) {
    const match = audioBase64.match(/^data:([^;,]+)/);
    if (match && match[1]) {
      mimeType = match[1];
    }
  }

  // Normalize to base MIME type — Gemini rejects codec suffixes like 'audio/webm;codecs=opus'
  let cleanMime = mimeType.split(";")[0].trim().toLowerCase();
  if (!cleanMime || cleanMime.includes("matroska") || cleanMime.includes("octet")) {
    cleanMime = "audio/webm";
  }
  // Map unsupported types to webm
  if (![
    "audio/wav", "audio/wave", "audio/x-wav",
    "audio/webm", "audio/mp4", "audio/mp3", "audio/mpeg",
    "audio/ogg", "audio/flac", "audio/aac",
  ].includes(cleanMime)) {
    cleanMime = "audio/webm";
  }

  const candidateModels = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash", "gemini-flash-latest"];
  let lastError: any = null;

  for (const model of candidateModels) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      inlineData: {
                        mimeType: cleanMime,
                        data: cleanBase64,
                      },
                    },
                    {
                      text: "Transcribe the spoken audio verbatim into plain text. Return ONLY the transcribed words without any quotes, preamble, timestamps, or markdown.",
                    },
                  ],
                },
              ],
            }),
            signal: AbortSignal.timeout(15000),
          }
        );

        if (res.status === 503) {
          // Overloaded — retry once after a short delay
          lastError = new Error(`Model ${model} overloaded (503)`);
          await new Promise((r) => setTimeout(r, 1500));
          continue;
        }

        if (!res.ok) {
          const errorText = await res.text().catch(() => "");
          let parsedMsg = errorText;
          try {
            const errObj = JSON.parse(errorText);
            parsedMsg = errObj?.error?.message || errorText;
          } catch {}
          lastError = new Error(`Model ${model} returned ${res.status}: ${parsedMsg}`);
          break; // Try next model
        }

        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
        if (text && !text.match(/^(\[.*\]|silence|no speech|audio event)$/i)) {
          return text;
        }
        // Returned empty or non-speech — try next model
        break;
      } catch (err: any) {
        lastError = err;
        if (attempt === 0) {
          await new Promise((r) => setTimeout(r, 500));
        }
      }
    }
  }

  throw lastError || new Error("Google audio transcription failed across all candidate models");
}

export async function transcribeAudio(
  audioBase64: string,
  mimeType = "audio/webm"
): Promise<{ text: string; provider: "elevenlabs" | "google" }> {
  // 1. Try ElevenLabs Speech-to-Text if API key is provided
  if (env.elevenLabsApiKey()) {
    try {
      const text = await transcribeAudioWithElevenLabs(audioBase64, mimeType);
      if (text) {
        return { text, provider: "elevenlabs" };
      }
    } catch (err: any) {
      console.warn("[VoiceService] ElevenLabs STT fallback to Google:", err?.message);
    }
  }

  // 2. Fall back to Google Gemini audio transcription
  const text = await transcribeAudioWithGoogle(audioBase64, mimeType);
  return { text, provider: "google" };
}

/**
 * Processes a voice update whose speech can either be transcribed on the client
 * (Web Speech API) or transcribed server-side via Google Gemini audio recognition.
 */
export async function processVoiceUpdate(
  ctx: AuthContext,
  input: string | { transcript?: string; audio?: string; mimeType?: string }
): Promise<VoiceResponseDTO> {
  const { voiceUpdates } = await collections();
  const voiceId = new ObjectId();

  let transcript = typeof input === "string" ? input.trim() : (input.transcript || "").trim();
  let mimeType = typeof input === "object" && input.mimeType ? input.mimeType : "text/plain; source=web-speech-api";
  let sizeBytes = transcript ? Buffer.byteLength(transcript, "utf8") : 0;

  // If no client transcript is provided but audio is present, transcribe with ElevenLabs / Google Gemini
  let transcriptionError: string | null = null;
  if (!transcript && typeof input === "object" && input.audio) {
    try {
      console.log("[VoiceService] Transcribing audio, mimeType:", input.mimeType, "size:", Math.round(input.audio.length * 0.75), "bytes");
      const result = await transcribeAudio(input.audio, input.mimeType);
      transcript = result.text;
      mimeType = input.mimeType || `audio/webm; source=${result.provider}-stt`;
      sizeBytes = Math.round((input.audio.length * 3) / 4);
      console.log("[VoiceService] Transcription success (" + result.provider + "):", transcript?.slice(0, 80));
    } catch (err: any) {
      transcriptionError = err?.message || "Transcription failed";
      console.error("[VoiceService] AI audio transcription error:", transcriptionError);
    }
  }

  const doc: VoiceUpdateDoc = {
    _id: voiceId,
    familyId: ctx.familyId,
    userId: ctx.userId,
    status: transcript ? "transcribed" : "transcription_failed",
    transcript: transcript || null,
    mimeType,
    sizeBytes,
    error: transcript ? null : "Empty transcript",
    pendingActionIds: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await voiceUpdates.insertOne(doc);

  if (!transcript) {
    let cleanErr = transcriptionError;
    if (cleanErr && cleanErr.includes("{")) {
      try {
        const jsonMatch = cleanErr.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          cleanErr = parsed?.error?.message || cleanErr;
        }
      } catch {}
    }
    const errMsg = cleanErr
      ? (cleanErr.startsWith("Transcription failed") ? cleanErr : `Transcription failed: ${cleanErr}`)
      : "We couldn't hear any speech. Please try speaking clearly into your microphone.";
    return {
      voiceUpdateId: voiceId.toHexString(),
      transcript: null,
      reply: null,
      actions: [],
      toolsUsed: [],
      error: errMsg,
      stage: "transcription",
    };
  }

  // Feed transcript to Kutumb Agent / Gemma
  try {
    const result = await executeKutumbQuery(ctx, transcript, "voice");
    const actionObjectIds = result.actions.map((a) => new ObjectId(a.id));

    await voiceUpdates.updateOne(
      { _id: voiceId },
      {
        $set: {
          status: "processed",
          pendingActionIds: actionObjectIds,
          updatedAt: new Date(),
        },
      }
    );

    await logActivity(
      ctx.familyId,
      { userId: ctx.userId, name: ctx.userName },
      "voice_update",
      `${ctx.userName} recorded a voice note: "${transcript.length > 50 ? transcript.slice(0, 47) + "..." : transcript}"`,
      { type: "voice_update", id: voiceId }
    );

    return {
      voiceUpdateId: voiceId.toHexString(),
      transcript,
      reply: result.reply,
      actions: result.actions,
      toolsUsed: result.toolsUsed,
      error: null,
      stage: null,
    };
  } catch (err: any) {
    // PRD: "Always preserve the transcript. If processing fails, the original transcript must not be lost."
    await voiceUpdates.updateOne(
      { _id: voiceId },
      {
        $set: {
          status: "processing_failed",
          error: err?.message || "Agent understanding failed",
          updatedAt: new Date(),
        },
      }
    );

    return {
      voiceUpdateId: voiceId.toHexString(),
      transcript,
      reply: "I heard your voice update, but had trouble parsing actions automatically. Your words have been preserved.",
      actions: [],
      toolsUsed: [],
      error: err?.message || "Parsing failed",
      stage: "processing",
    };
  }
}
