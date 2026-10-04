"use client";

import { useState, useRef, useEffect } from "react";
import type { DigestDTO } from "@/lib/types";

export function AudioDigestPlayer({
  digest,
  onRefresh,
}: {
  digest: DigestDTO | null;
  onRefresh?: () => void;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  function handlePlay() {
    if (!digest?.spokenText) return;

    if (isPlaying) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
      return;
    }

    try {
      window.speechSynthesis.cancel(); // clear queue
      const utterance = new SpeechSynthesisUtterance(digest.spokenText);
      utterance.onend = () => setIsPlaying(false);
      utterance.onerror = () => {
        setIsPlaying(false);
        setError("Speech synthesis interrupted or failed.");
      };
      window.speechSynthesis.speak(utterance);
      setIsPlaying(true);
      setError(null);
    } catch (err: any) {
      setError(err?.message || "Audio unavailable. You can read the text digest below.");
    }
  }

  if (!digest) {
    return (
      <div className="bg-white border border-[#ede7df] rounded-2xl p-5 shadow-xs text-center space-y-2">
        <p className="text-sm font-medium text-[#27221d]">No family digest generated yet today.</p>
        <button
          onClick={onRefresh}
          className="text-xs font-semibold text-[#c2593f] hover:underline"
        >
          Generate Today&apos;s Digest
        </button>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-white via-white to-[#faf3ee] border border-[#f0e3d8] rounded-3xl p-5 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#faf3ee] border border-[#f0e3d8] text-[#c2593f] flex items-center justify-center text-lg font-bold shadow-xs">
            📻
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base text-[#27221d]">Family Daily Digest</h3>
              <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-[#f3eae4] text-[#c2593f]">
                {digest.generatedBy === "gemma" ? "Gemma ✦" : "Summary"}
              </span>
            </div>
            <p className="text-xs text-[#6e655f] mt-0.5">{digest.headline}</p>
          </div>
        </div>

        {/* Audio Listen Button */}
        <button
          onClick={handlePlay}
          className="px-4 py-2 rounded-2xl bg-[#c2593f] text-white hover:bg-[#aa4a32] shadow-sm font-semibold text-xs transition flex items-center gap-2 shrink-0 disabled:opacity-50"
        >
          {isPlaying ? (
            <>
              <span>⏸</span>
              <span>Stop Digest</span>
            </>
          ) : (
            <>
              <span>▶</span>
              <span>Listen to today&apos;s digest</span>
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center justify-between">
          <span>{error}</span>
          <span className="text-[10px] font-semibold text-amber-900 uppercase">Text Available</span>
        </div>
      )}

      {/* Sections Summary */}
      {digest.sections.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-[#ede7df]/60">
          {digest.sections.map((sec, idx) => (
            <div key={idx} className="bg-white/80 rounded-2xl p-3 border border-[#ede7df]/80 shadow-2xs space-y-1.5">
              <h5 className="text-xs font-bold text-[#c2593f] uppercase tracking-wider">{sec.title}</h5>
              <ul className="text-xs text-[#27221d] space-y-1">
                {sec.items.map((item, itemIdx) => (
                  <li key={itemIdx} className="flex items-start gap-1.5 leading-snug">
                    <span className="text-[#c2593f] mt-0.5">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between pt-1 text-[11px] text-[#6e655f]">
        <span>Powered by Gemma &amp; Web Speech</span>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="hover:text-[#c2593f] transition font-medium"
          >
            Refresh digest ⟳
          </button>
        )}
      </div>
    </div>
  );
}
