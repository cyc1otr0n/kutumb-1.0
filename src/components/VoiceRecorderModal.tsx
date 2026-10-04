"use client";

import { useState, useRef, useEffect } from "react";
import type { VoiceResponseDTO } from "@/lib/types";

export function VoiceRecorderModal({
  isOpen,
  onClose,
  onVoiceResult,
}: {
  isOpen: boolean;
  onClose: () => void;
  onVoiceResult: (result: VoiceResponseDTO) => void;
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState("");

  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isOpen) {
      cleanup();
    }
  }, [isOpen]);

  function cleanup() {
    if (timerRef.current) clearInterval(timerRef.current);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }
    setIsRecording(false);
    setSeconds(0);
    setProcessing(false);
    setError(null);
    setTranscript("");
  }

  function startRecording() {
    setError(null);
    setTranscript("");
    try {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        throw new Error("Speech recognition is not supported in this browser. Please use Chrome or Safari.");
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognitionRef.current = recognition;

      let finalTranscript = "";

      recognition.onresult = (event: any) => {
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }
        setTranscript(finalTranscript + interim);
      };

      recognition.onerror = (event: any) => {
        if (event.error !== "no-speech") {
          setError(`Speech recognition error: ${event.error}`);
          stopRecording();
        }
      };

      recognition.start();
      setIsRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => {
        setSeconds((s) => s + 1);
      }, 1000);
    } catch (err: any) {
      setError(err?.message || "Could not start voice recognition.");
    }
  }

  function stopRecording() {
    if (timerRef.current) clearInterval(timerRef.current);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }
    setIsRecording(false);
    
    // Allow state to settle before uploading
    setTimeout(() => {
      setTranscript((currentTranscript) => {
        if (currentTranscript.trim()) {
          uploadTranscript(currentTranscript);
        } else {
          setError("No speech detected. Please try again.");
        }
        return currentTranscript;
      });
    }, 500);
  }

  async function uploadTranscript(text: string) {
    setProcessing(true);
    setError(null);
    try {
      const res = await fetch("/api/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: text }),
      });

      const data: VoiceResponseDTO = await res.json();
      if (!res.ok) {
        throw new Error((data as any).error?.message || "Voice processing failed");
      }

      onVoiceResult(data);
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to process voice note.");
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
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl border border-[#ede7df] space-y-6 text-center animate-in fade-in zoom-in-95 duration-200">
        <div>
          <span className="w-12 h-12 rounded-2xl bg-[#faf3ee] text-[#c2593f] inline-flex items-center justify-center text-xl font-bold mb-3 shadow-xs">
            🎙️
          </span>
          <h3 className="text-lg font-bold text-[#27221d]">Speak to Kutumb</h3>
          <p className="text-xs text-[#6e655f] mt-1 max-w-xs mx-auto">
            Say what you need to remember or announce — events, tasks, or updates. Gemma will do the rest.
          </p>
        </div>

        {/* Recording Animation / Timer */}
        <div className="py-6 flex flex-col items-center justify-center">
          {processing ? (
            <div className="space-y-3">
              <div className="w-16 h-16 rounded-full border-4 border-[#c2593f]/20 border-t-[#c2593f] animate-spin mx-auto" />
              <p className="text-sm font-semibold text-[#27221d]">Processing with Gemma...</p>
              <p className="text-xs text-[#6e655f]">Extracting plans and tasks</p>
            </div>
          ) : isRecording ? (
            <div className="space-y-4">
              <div className="relative">
                <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mx-auto animate-ping opacity-75 absolute inset-0" />
                <button
                  onClick={stopRecording}
                  className="relative w-20 h-20 rounded-full bg-red-600 text-white font-bold flex items-center justify-center mx-auto shadow-lg hover:bg-red-700 transition"
                >
                  <span className="w-6 h-6 rounded-xs bg-white block" />
                </button>
              </div>
              <div className="text-2xl font-mono font-bold text-red-600">
                {formatTimer(seconds)}
              </div>
              {transcript && (
                <div className="mt-4 p-3 bg-gray-50 rounded-xl text-sm italic text-gray-700 text-left max-h-32 overflow-y-auto w-full">
                  "{transcript}"
                </div>
              )}
              <p className="text-xs text-[#6e655f]">Tap the square when you&apos;re finished speaking</p>
            </div>
          ) : (
            <div className="space-y-4">
              <button
                onClick={startRecording}
                className="w-20 h-20 rounded-full bg-[#c2593f] text-white flex items-center justify-center mx-auto shadow-lg hover:bg-[#aa4a32] hover:scale-105 transition"
              >
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </button>
              <p className="text-sm font-medium text-[#27221d]">Tap the microphone to start recording</p>
            </div>
          )}
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
            {error}
          </div>
        )}

        <div className="flex items-center justify-center pt-2 border-t border-[#ede7df]">
          <button
            onClick={onClose}
            disabled={processing}
            className="px-5 py-2 rounded-xl text-sm font-medium text-[#6e655f] hover:bg-[#f6f2ec] transition disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
