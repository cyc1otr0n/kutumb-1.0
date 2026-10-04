import { NextRequest, NextResponse } from "next/server";
import { env } from "@/server/env";
import { requireFamilyAuth } from "@/server/auth/guard";
import { invalid } from "@/server/errors";

export async function POST(req: NextRequest) {
  try {
    await requireFamilyAuth();
    const body = await req.json().catch(() => ({}));
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    const voiceId = typeof body?.voiceId === "string" ? body.voiceId : env.elevenLabsVoiceId() || "21m00Tcm4TlvDq8ikWAM";

    if (!text) {
      throw invalid("Text is required for TTS synthesis");
    }

    const apiKey = env.elevenLabsApiKey();
    if (!apiKey) {
      return NextResponse.json({ fallback: true, message: "ElevenLabs API key not configured" }, { status: 200 });
    }

    // Call ElevenLabs Text-to-Speech API
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_turbo_v2_5", // ultra-low latency, highly realistic
        voice_settings: {
          stability: 0.45,
          similarity_boost: 0.8,
        },
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.warn("[ElevenLabs TTS] API error:", response.status, errText);
      return NextResponse.json({ fallback: true, message: `ElevenLabs returned ${response.status}` }, { status: 200 });
    }

    const audioBuffer = await response.arrayBuffer();
    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=43200",
      },
    });
  } catch (err: any) {
    console.warn("[TTS Route] Error:", err?.message);
    return NextResponse.json({ fallback: true, message: err?.message || "TTS error" }, { status: 200 });
  }
}
