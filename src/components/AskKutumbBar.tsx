"use client";

import { useState } from "react";
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

  const samplePrompts = [
    "What's happening tomorrow?",
    "The electrician is coming tomorrow at 11. We need to clear the balcony.",
    "Remind everyone tomorrow morning.",
    "Dinner is now at 7 instead of 6.",
    "Save that Dad doesn't like spicy food.",
  ];

  async function handleSubmit(e?: React.FormEvent, directText?: string) {
    if (e) e.preventDefault();
    const textToSubmit = directText || query;
    if (!textToSubmit.trim() || loading) return;

    setLoading(true);
    setError(null);
    setVoiceTranscript(null);

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: textToSubmit.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to process query");
      }

      setResponse(data);
      if (!directText) setQuery("");
    } catch (err: any) {
      setError(err?.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function handleVoiceResult(result: VoiceResponseDTO) {
    setVoiceTranscript(result.transcript);
    setResponse({
      reply: result.reply || "I've processed your voice note.",
      actions: result.actions,
      toolsUsed: result.toolsUsed,
    });
  }

  return (
    <div className="space-y-3">
      {/* Search & Voice Input Box */}
      <form
        onSubmit={(e) => handleSubmit(e)}
        className="relative bg-white border border-[#ede7df] hover:border-[#c2593f]/40 focus-within:border-[#c2593f] focus-within:ring-3 focus-within:ring-[#c2593f]/10 rounded-2xl shadow-xs transition p-1.5 flex items-center gap-2"
      >
        <div className="pl-3 text-[#c2593f]">
          <span className="text-base font-bold">कु</span>
        </div>

        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask Kutumb anything... plans, tasks, reminders, updates"
          className="flex-1 text-sm bg-transparent outline-hidden text-[#27221d] placeholder:text-[#6e655f]/60 py-2.5 px-2"
          disabled={loading}
        />

        {/* Microphone Voice Button */}
        <button
          type="button"
          onClick={() => setVoiceModalOpen(true)}
          title="Speak to Kutumb (Web Speech)"
          className="p-2.5 rounded-xl text-[#6e655f] hover:text-[#c2593f] hover:bg-[#faf3ee] transition shrink-0"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
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
      />
    </div>
  );
}
