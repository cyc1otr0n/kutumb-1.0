"use client";

import { useState, useRef } from "react";
import { VoiceRecorderModal } from "./VoiceRecorderModal";
import { ActionConfirmationCard } from "./ActionConfirmationCard";
import type { AskResponseDTO, VoiceResponseDTO } from "@/lib/types";

export function AskKutumbBar({
  onDataChanged,
  defaultQuery = "",
}: {
  onDataChanged?: () => void;
  defaultQuery?: string;
}) {
  const [query, setQuery] = useState(defaultQuery);
  const [loading, setLoading] = useState(false);
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const [response, setResponse] = useState<AskResponseDTO | null>(null);
  const [voiceTranscript, setVoiceTranscript] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isSubmittingRef = useState({ current: false })[0];

  const samplePrompts = [
    "What's happening tomorrow?",
    "The electrician is coming tomorrow at 11. We need to clear the balcony.",
    "Remind everyone tomorrow morning.",
    "Dinner is now at 7 instead of 6.",
    "Save that Dad doesn't like spicy food.",
  ];

  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [transcribing, setTranscribing] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  async function startVoiceRecording() {
    setError(null);
    try {
      if (!navigator?.mediaDevices?.getUserMedia) {
        throw new Error("Audio recording is not supported in this browser environment.");
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
        await processRecordedAudio(recordedBlob);
      };

      recorder.start(250);
      setIsRecording(true);
      setRecordingSeconds(0);

      timerRef.current = setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
    } catch (err: any) {
      console.error("Microphone access error:", err);
      if (err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError") {
        setError("Microphone permission was denied. Please allow microphone access in your browser.");
      } else {
        setError(err?.message || "Could not start audio recording.");
      }
      setIsRecording(false);
    }
  }

  function stopVoiceRecording(cancel = false) {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (cancel) {
      audioChunksRef.current = [];
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((t) => t.stop());
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

  async function processRecordedAudio(audioBlob: Blob) {
    if (audioBlob.size < 500) {
      setError("No speech was detected. Please try recording again.");
      return;
    }

    setTranscribing(true);
    setError(null);

    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
      });
      reader.readAsDataURL(audioBlob);
      const base64Audio = await base64Promise;

      const res = await fetch("/api/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audio: base64Audio,
          mimeType: audioBlob.type || "audio/webm",
        }),
      });

      const data: VoiceResponseDTO = await res.json();
      if (!res.ok) {
        throw new Error((data as any)?.error?.message || (data as any)?.error || "Voice transcription failed");
      }

      // If transcript is empty/null, show the error from the server (not a silent fallback)
      if (!data.transcript && data.error) {
        setError(data.error);
        return;
      }

      if (data.transcript) {
        setQuery(data.transcript);
        setVoiceTranscript(data.transcript);
      }

      if (data.reply || (data.actions && data.actions.length > 0)) {
        setResponse({
          reply: data.reply || "Done! Your voice update has been processed.",
          actions: data.actions || [],
          toolsUsed: data.toolsUsed || [],
        });

        if (onDataChanged) {
          onDataChanged();
        }
      } else if (!data.transcript) {
        setError("Couldn't transcribe audio. Please speak clearly and try again.");
      }
    } catch (err: any) {
      setError(err?.message || "Could not transcribe audio. Please check your API keys or try again.");
    } finally {
      setTranscribing(false);
    }
  }

  async function handleSubmit(e?: React.FormEvent, directText?: string) {
    if (e) e.preventDefault();
    if (isRecording) {
      stopVoiceRecording(true);
    }

    const textToSubmit = (directText !== undefined ? directText : query).trim();
    if (!textToSubmit || loading || isSubmittingRef.current) return;

    isSubmittingRef.current = true;
    setLoading(true);
    setError(null);
    setVoiceTranscript(null);

    // Clean input clearing immediately on submission
    if (directText === undefined) {
      setQuery("");
    }

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: textToSubmit }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to process query");
      }

      setResponse(data);
      if (onDataChanged) {
        onDataChanged();
      }
    } catch (err: any) {
      setError(err?.message || "Something went wrong.");
      // If error occurs, restore input so user can retry
      if (directText === undefined) {
        setQuery(textToSubmit);
      }
    } finally {
      setLoading(false);
      isSubmittingRef.current = false;
    }
  }

  function handleVoiceResult(result: VoiceResponseDTO) {
    if (result.transcript) {
      setVoiceTranscript(result.transcript);
      setQuery(result.transcript);
    }
    setResponse({
      reply: result.reply || "I've processed your voice note.",
      actions: result.actions,
      toolsUsed: result.toolsUsed,
    });
    if (onDataChanged) {
      onDataChanged();
    }
  }

  return (
    <div className="space-y-3">
      {/* Search & Voice Input Box */}
      <form
        onSubmit={(e) => handleSubmit(e)}
        className={`relative bg-white border ${
          isRecording
            ? "border-red-500 ring-4 ring-red-100"
            : transcribing
            ? "border-[#c2593f] ring-4 ring-[#c2593f]/20"
            : "border-[#ede7df] hover:border-[#c2593f]/40 focus-within:border-[#c2593f] focus-within:ring-3 focus-within:ring-[#c2593f]/10"
        } rounded-2xl shadow-xs transition p-1.5 flex items-center gap-2`}
      >
        <div className="pl-3 text-[#c2593f]">
          <span className="text-base font-bold">कु</span>
        </div>

        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={
            transcribing
              ? "Transcribing your voice with AI..."
              : isRecording
              ? `Recording audio (${recordingSeconds}s)... speak naturally`
              : "Ask Kutumb anything... plans, tasks, reminders, updates"
          }
          className={`flex-1 text-sm bg-transparent outline-hidden text-[#27221d] py-2.5 px-2 ${
            isRecording
              ? "placeholder:text-red-600 placeholder:animate-pulse font-medium"
              : transcribing
              ? "placeholder:text-[#c2593f] placeholder:animate-pulse font-medium"
              : "placeholder:text-[#6e655f]/60"
          }`}
          disabled={loading || transcribing}
        />

        {/* Live Recording Status Pulse */}
        {isRecording && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-xl bg-red-50 text-red-600 text-xs font-semibold shrink-0">
            <span className="w-2 h-2 rounded-full bg-red-600 animate-ping" />
            <span>{Math.floor(recordingSeconds / 60)}:{(recordingSeconds % 60).toString().padStart(2, "0")}</span>
          </div>
        )}

        {/* AI Transcribing Spinner */}
        {transcribing && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#faf3ee] text-[#c2593f] text-xs font-semibold shrink-0 animate-pulse">
            <span className="w-3.5 h-3.5 rounded-full border-2 border-[#c2593f] border-t-transparent animate-spin" />
            <span>AI Transcribing</span>
          </div>
        )}

        {/* Cancel Recording Button */}
        {isRecording && (
          <button
            type="button"
            onClick={() => stopVoiceRecording(true)}
            title="Cancel recording"
            className="p-2 rounded-xl text-gray-400 hover:text-red-600 hover:bg-red-50 transition text-xs font-bold"
          >
            ✕
          </button>
        )}

        {/* Direct In-Bar Microphone / Stop Button */}
        <button
          type="button"
          onClick={() => {
            if (isRecording) {
              stopVoiceRecording(false);
            } else {
              startVoiceRecording();
            }
          }}
          disabled={loading || transcribing}
          title={isRecording ? "Click to stop recording and send" : "Click to record voice note"}
          className={`p-2.5 rounded-xl transition shrink-0 ${
            isRecording
              ? "bg-red-600 text-white shadow-md animate-pulse hover:bg-red-700"
              : "text-[#6e655f] hover:text-[#c2593f] hover:bg-[#faf3ee]"
          }`}
        >
          {isRecording ? (
            <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          )}
        </button>

        {/* Modal Opener Button */}
        <button
          type="button"
          onClick={() => {
            if (isRecording) stopVoiceRecording(true);
            setVoiceModalOpen(true);
          }}
          title="Open Voice Note Recording Modal"
          className="p-2 rounded-xl text-[#6e655f] hover:text-[#c2593f] hover:bg-[#faf3ee] transition text-xs font-semibold shrink-0 hidden sm:block"
        >
          🎙️ Modal
        </button>

        {/* Send Button */}
        <button
          type="submit"
          disabled={!query.trim() || loading}
          className="px-4 py-2.5 rounded-xl bg-[#c2593f] text-white hover:bg-[#aa4a32] shadow-xs font-semibold text-xs transition disabled:opacity-40 shrink-0 flex items-center gap-1.5"
        >
          {loading ? (
            <span className="animate-spin text-sm">⟳</span>
          ) : (
            <span>Ask</span>
          )}
        </button>
      </form>

      {/* Suggested demo prompts pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
        <span className="text-[11px] font-semibold text-[#6e655f] uppercase tracking-wider shrink-0 mr-1">
          Try:
        </span>
        {samplePrompts.map((prompt, i) => (
          <button
            key={i}
            type="button"
            onClick={() => {
              setQuery(prompt);
              handleSubmit(undefined, prompt);
            }}
            className="px-3 py-1 rounded-full bg-white border border-[#ede7df] text-[#6e655f] hover:border-[#c2593f] hover:text-[#c2593f] hover:bg-[#faf3ee] transition text-xs whitespace-nowrap shadow-2xs"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Voice Transcript banner if voice was used */}
      {voiceTranscript && (
        <div className="p-3 bg-[#faf3ee] border border-[#f0e3d8] rounded-2xl text-xs text-[#27221d] space-y-1">
          <div className="flex items-center gap-2 text-[#c2593f] font-semibold">
            <span>🎙️ Transcribed:</span>
          </div>
          <p className="italic font-medium">&ldquo;{voiceTranscript}&rdquo;</p>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-700">
          {error}
        </div>
      )}

      {/* Agent Response Card */}
      {response && (
        <div className="bg-white border border-[#f0e3d8] rounded-3xl p-5 shadow-xs space-y-4 animate-in fade-in duration-200">
          <div className="flex items-start gap-3">
            <span className="w-8 h-8 rounded-xl bg-[#faf3ee] text-[#c2593f] flex items-center justify-center font-bold text-sm shrink-0 border border-[#f0e3d8]">
              कु
            </span>
            <div className="space-y-1 flex-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-[#c2593f] uppercase tracking-wider">Kutumb</span>
                <span className="text-[10px] text-[#6e655f]">Gemma ✦ Mastra</span>
              </div>
              <p className="text-sm text-[#27221d] whitespace-pre-line leading-relaxed font-normal">
                {response.reply}
              </p>
            </div>
          </div>

          {/* Pending Action Confirmation Cards */}
          {response.actions.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-[#ede7df]/80">
              <h5 className="text-xs font-bold text-[#6e655f] uppercase tracking-wider">
                Actions Ready to Confirm:
              </h5>
              {response.actions.map((action) => (
                <ActionConfirmationCard
                  key={action.id}
                  action={action}
                  onResolved={onDataChanged}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Voice Recording Modal */}
      <VoiceRecorderModal
        isOpen={voiceModalOpen}
        onClose={() => setVoiceModalOpen(false)}
        onVoiceResult={handleVoiceResult}
        onTranscriptChange={(live) => setQuery(live)}
      />
    </div>
  );
}
