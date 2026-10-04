import { ObjectId } from "mongodb";
import { collections } from "../db/client";
import type { VoiceUpdateDoc } from "../db/types";
import type { AuthContext } from "../context";
import { executeKutumbQuery } from "../agent/kutumb.agent";
import { logActivity } from "./family.service";
import type { VoiceResponseDTO } from "@/lib/types";

/**
 * Processes a voice update whose speech has already been transcribed on the client
 * using the browser-native Web Speech API (SpeechRecognition). No paid STT provider
 * is involved — the server only receives text.
 */
export async function processVoiceUpdate(
  ctx: AuthContext,
  rawTranscript: string
): Promise<VoiceResponseDTO> {
  const { voiceUpdates } = await collections();
  const voiceId = new ObjectId();
  const transcript = rawTranscript.trim();

  const doc: VoiceUpdateDoc = {
    _id: voiceId,
    familyId: ctx.familyId,
    userId: ctx.userId,
    status: transcript ? "transcribed" : "transcription_failed",
    transcript: transcript || null,
    mimeType: "text/plain; source=web-speech-api",
    sizeBytes: Buffer.byteLength(transcript, "utf8"),
    error: transcript ? null : "Empty transcript",
    pendingActionIds: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await voiceUpdates.insertOne(doc);

  if (!transcript) {
    return {
      voiceUpdateId: voiceId.toHexString(),
      transcript: null,
      reply: null,
      actions: [],
      toolsUsed: [],
      error: "We couldn't hear anything. Please try speaking again.",
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
