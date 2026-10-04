import { NextRequest } from "next/server";
import { handleApi } from "@/server/api";
import { requireFamilyAuth } from "@/server/auth/guard";
import { processVoiceUpdate } from "@/server/services/voice.service";
import { invalid } from "@/server/errors";

/**
 * Accepts a transcript produced in the browser by the native Web Speech API
 * (SpeechRecognition / webkitSpeechRecognition). Body: { transcript: string }
 */
export async function POST(req: NextRequest) {
  return handleApi(async () => {
    const ctx = await requireFamilyAuth();
    const body = await req.json().catch(() => null);
    const transcript = body?.transcript;
    if (typeof transcript !== "string") {
      throw invalid("A transcript string is required");
    }
    if (transcript.length > 5000) {
      throw invalid("Transcript is too long");
    }

    return processVoiceUpdate(ctx, transcript);
  });
}
