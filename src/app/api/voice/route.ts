import { NextRequest } from "next/server";
import { handleApi } from "@/server/api";
import { requireFamilyAuth } from "@/server/auth/guard";
import { processVoiceUpdate } from "@/server/services/voice.service";
import { invalid } from "@/server/errors";

/**
 * Accepts recorded audio (Base64) or direct text notes.
 * Transcribes audio via ElevenLabs Speech-to-Text with Google Gemini fallback,
 * then processes family intent through Gemma. Body: { audio?: string, mimeType?: string, transcript?: string }
 */
export async function POST(req: NextRequest) {
  return handleApi(async () => {
    const ctx = await requireFamilyAuth();
    const body = await req.json().catch(() => null);
    const transcript = typeof body?.transcript === "string" ? body.transcript.trim() : "";
    const audio = typeof body?.audio === "string" ? body.audio.trim() : "";
    const mimeType = typeof body?.mimeType === "string" ? body.mimeType : undefined;

    if (!transcript && !audio) {
      throw invalid("Either a transcript or audio recording is required");
    }
    if (transcript.length > 5000) {
      throw invalid("Transcript is too long");
    }

    return processVoiceUpdate(ctx, { transcript, audio, mimeType });
  });
}
