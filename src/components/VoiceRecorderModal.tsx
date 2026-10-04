"use client";

import { useState, useRef, useEffect } from "react";
import type { VoiceResponseDTO } from "@/lib/types";

export function VoiceRecorderModal({
  isOpen,
  onClose,
  onVoiceResult,
  onTranscriptChange,
}: {
  isOpen: boolean;
  onClose: () => void;
  onVoiceResult: (result: VoiceResponseDTO) => void;
  onTranscriptChange?: (text: string) => void;
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState<string>("Transcribing audio with AI...");
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isOpen) {
      startRecording();
    } else {
      cleanup();
    }
    return () => {
      cleanup();
    };
  }, [isOpen]);

  function cleanup() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((track) => track.stop());
      audioStreamRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {}
    }
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];

    setIsRecording(false);
    setSeconds(0);
    setProcessing(false);
    setError(null);
    setTranscript("");
  }

  async function startRecording() {
    cleanup();
    setError(null);
    setTranscript("");

    try {
      if (!navigator?.mediaDevices?.getUserMedia) {
        throw new Error("Microphone recording is not supported in this browser.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      audioChunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4")
        ? "audio/mp4"
        : "";

      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        audioStreamRef.current = null;

        if (audioChunksRef.current.length === 0) return;
        const recordedBlob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        audioChunksRef.current = [];
        await submitAudioBlob(recordedBlob);
      };

      recorder.start(250);
      setIsRecording(true);
      setSeconds(0);

      timerRef.current = setInterval(() => {
        setSeconds((s) => s + 1);
      }, 1000);
    } catch (err: any) {
      console.error("Microphone error:", err);
      if (err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError") {
        setError("Microphone permission denied. Please allow microphone access in your browser settings.");
      } else {
        setError(err?.message || "Could not start audio recording.");
      }
      setIsRecording(false);
    }
  }

  function stopRecording(shouldSubmit = true) {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (!shouldSubmit) {
      audioChunksRef.current = [];
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((track) => track.stop());
        audioStreamRef.current = null;
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        try {
          mediaRecorderRef.current.stop();
        } catch (e) {}
      }
      setIsRecording(false);
      return;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {}
    }
    setIsRecording(false);
  }

  async function submitAudioBlob(blob: Blob) {
    if (blob.size < 600) {
      setError("No voice detected. Please speak louder or closer to the microphone.");
      return;
    }

    setProcessing(true);
    setProcessingStep("Transcribing audio with AI...");
    setError(null);

    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
      });
      reader.readAsDataURL(blob);
      const base64Audio = await base64Promise;

      setProcessingStep("Gemma is parsing family plans & actions...");

      const res = await fetch("/api/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audio: base64Audio,
          mimeType: blob.type || "audio/webm",
        }),
      });

      const data: VoiceResponseDTO = await res.json();
      if (!res.ok) {
        throw new Error((data as any)?.error?.message || (data as any)?.error || "Voice processing failed");
      }

      if (data.transcript) {
        setTranscript(data.transcript);
        if (onTranscriptChange) onTranscriptChange(data.transcript);
      }

      onVoiceResult(data);
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to process voice update.");
    } finally {
      setProcessing(false);
    }
  }

  async function submitText(text: string) {
    if (!text.trim()) return;
    setProcessing(true);
    setProcessingStep("Gemma is parsing family plans & actions...");
    setError(null);

    try {
      const res = await fetch("/api/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: text.trim() }),
      });

      const data: VoiceResponseDTO = await res.json();
      if (!res.ok) {
        throw new Error((data as any)?.error?.message || (data as any)?.error || "Voice processing failed");
      }

      onVoiceResult(data);
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to process text update.");
    } finally {
      setProcessing(false);
    }
  }

  if (!isOpen) return null;

  const formatTimer = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#ede7df] space-y-5 text-center animate-in fade-in zoom-in-95 duration-200">
        <div>
          <span className="w-12 h-12 rounded-2xl bg-[#faf3ee] text-[#c2593f] inline-flex items-center justify-center text-xl font-bold mb-2 shadow-xs">
            🎙️
          </span>
          <h3 className="text-lg font-bold text-[#27221d]">Speak to Kutumb</h3>
          <p className="text-xs text-[#6e655f] mt-1 max-w-xs mx-auto">
            Say what you need to remember or announce — plans, tasks, or updates. Gemma will parse it all.
          </p>
        </div>

        {/* Live Audio / Status Area */}
        <div className="py-2 flex flex-col items-center justify-center space-y-4">
          {processing ? (
            <div className="space-y-3 py-6">
              <div className="w-14 h-14 rounded-full border-4 border-[#c2593f]/20 border-t-[#c2593f] animate-spin mx-auto" />
              <p className="text-sm font-semibold text-[#27221d]">{processingStep}</p>
              <p className="text-xs text-[#6e655f]">Powered by ElevenLabs &amp; Google Gemma</p>
            </div>
          ) : isRecording ? (
            <div className="space-y-4 w-full">
              {/* Pulsing Red Microphone */}
              <div className="relative flex items-center justify-center py-2">
                <div className="w-24 h-24 rounded-full bg-red-100 flex items-center justify-center mx-auto animate-ping opacity-60 absolute" />
                <button
                  type="button"
                  onClick={() => stopRecording(true)}
                  className="relative w-20 h-20 rounded-full bg-red-600 text-white font-bold flex items-center justify-center mx-auto shadow-lg hover:bg-red-700 transition"
                  title="Click to finish and submit"
                >
                  <span className="w-6 h-6 rounded-xs bg-white block" />
                </button>
              </div>

              {/* Timer and listening indicator */}
              <div className="space-y-1">
                <div className="text-2xl font-mono font-bold text-red-600">
                  {formatTimer(seconds)}
                </div>
                <div className="flex items-center justify-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-600 animate-ping" />
                  <span className="text-xs font-semibold text-red-600 uppercase tracking-wider">
                    Recording audio...
                  </span>
                </div>
              </div>

              {/* Visual Audio Recording Waves */}
              <div className="flex items-center justify-center gap-1 h-8">
                {[40, 75, 55, 90, 65, 80, 50, 85, 60, 45].map((height, i) => (
                  <div
                    key={i}
                    className="w-1 bg-red-500 rounded-full animate-pulse"
                    style={{
                      height: `${Math.max(15, (height * (seconds % 2 === 0 ? 0.9 : 1.2)) % 32)}px`,
                      animationDelay: `${i * 80}ms`,
                    }}
                  />
                ))}
              </div>

              <p className="text-xs text-[#6e655f]">
                Tap the white square above or click &ldquo;Done Speaking&rdquo; when you are finished.
              </p>
            </div>
          ) : (
            <div className="space-y-4 w-full">
              {/* Stopped / Editable View */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-[#27221d] text-left">
                  Your Spoken Request / Text Note:
                </label>
                <textarea
                  rows={3}
                  value={transcript}
                  onChange={(e) => {
                    setTranscript(e.target.value);
                    if (onTranscriptChange) onTranscriptChange(e.target.value);
                  }}
                  placeholder="Type or edit your voice note here..."
                  className="w-full text-sm p-3 rounded-2xl border border-[#ede7df] focus:border-[#c2593f] outline-hidden resize-none bg-gray-50/50"
                />
              </div>

              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={startRecording}
                  className="px-4 py-2 rounded-xl border border-[#ede7df] text-xs font-semibold text-[#27221d] hover:bg-[#faf3ee] transition flex items-center gap-1.5"
                >
                  <span>🎙️ Record Audio</span>
                </button>
                <button
                  type="button"
                  onClick={() => submitText(transcript)}
                  disabled={!transcript.trim()}
                  className="px-5 py-2 rounded-xl bg-[#c2593f] text-white text-xs font-semibold hover:bg-[#aa4a32] shadow-sm transition disabled:opacity-40"
                >
                  Send to Kutumb ➔
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Error notification */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-700 text-left">
            {error}
          </div>
        )}

        {/* Bottom Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-[#ede7df]">
          <button
            type="button"
            onClick={onClose}
            disabled={processing}
            className="px-4 py-2 rounded-xl text-xs font-medium text-[#6e655f] hover:bg-[#f6f2ec] transition disabled:opacity-50"
          >
            Cancel
          </button>

          {isRecording && (
            <button
              type="button"
              onClick={() => stopRecording(true)}
              className="px-4 py-2 rounded-xl bg-[#c2593f] text-white text-xs font-semibold hover:bg-[#aa4a32] transition"
            >
              Done Speaking ✓
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
