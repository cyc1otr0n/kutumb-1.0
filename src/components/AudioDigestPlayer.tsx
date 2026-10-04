"use client";

import { useState, useEffect, useRef } from "react";
import type { DigestDTO } from "@/lib/types";

export function constructDigestSpeechScript(digest: DigestDTO): string {
  const isCountOnly =
    !digest.spokenText ||
    (/\b\d+\s+event/i.test(digest.spokenText) && /\b\d+\s+pending task/i.test(digest.spokenText)) ||
    digest.spokenText === digest.headline;

  if (!isCountOnly && digest.spokenText.length > 60) {
    return digest.spokenText;
  }

  const parts: string[] = ["Good day! Here is today's family digest."];

  for (const sec of digest.sections) {
    if (!sec.items || sec.items.length === 0) continue;
    const title = sec.title.toLowerCase();

    let itemsSpeech = "";
    if (sec.items.length === 1) {
      itemsSpeech = sec.items[0];
    } else if (sec.items.length === 2) {
      itemsSpeech = `${sec.items[0]} and ${sec.items[1]}`;
    } else {
      itemsSpeech = `${sec.items.slice(0, -1).join(", ")}, and ${sec.items[sec.items.length - 1]}`;
    }

    if (title.includes("schedule") || title.includes("focus") || title.includes("today")) {
      parts.push(`Today's schedule: ${itemsSpeech}.`);
    } else if (title.includes("task")) {
      parts.push(`Tasks to handle: ${itemsSpeech}.`);
    } else if (title.includes("note") || title.includes("update")) {
      parts.push(`Recent notes: ${itemsSpeech}.`);
    } else if (title.includes("coming") || title.includes("upcoming")) {
      parts.push(`Coming up: ${itemsSpeech}.`);
    } else {
      parts.push(`${sec.title}: ${itemsSpeech}.`);
    }
  }

  if (digest.sections.length === 0) {
    parts.push("No family events, tasks, or updates recorded yet today.");
  } else {
    parts.push("Have a wonderful day!");
  }

  return parts.join(" ");
}

export function AudioDigestPlayer({
  digest,
  onRefresh,
}: {
  digest: DigestDTO | null;
  onRefresh?: () => void;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [showScript, setShowScript] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceName, setSelectedVoiceName] = useState<string>("");
  const [speechRate, setSpeechRate] = useState<number>(0.95);
  const [ttsEngine, setTtsEngine] = useState<"elevenlabs" | "browser" | null>(null);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sentencesRef = useRef<string[]>([]);
  const currentSentenceIdxRef = useRef<number>(0);
  const isCancelledRef = useRef<boolean>(false);
  const keepAliveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    function populateVoices() {
      const available = window.speechSynthesis.getVoices();
      if (!available || available.length === 0) return;
      setVoices(available);

      const googleVoice =
        available.find((v) => v.name.includes("Google") && v.lang.startsWith("en")) ||
        available.find((v) => (v.name.includes("Natural") || v.name.includes("Samantha")) && v.lang.startsWith("en")) ||
        available.find((v) => v.lang.startsWith("en")) ||
        available[0];

      if (googleVoice) {
        setSelectedVoiceName((prev) => prev || googleVoice.name);
      }
    }

    populateVoices();
    window.speechSynthesis.onvoiceschanged = populateVoices;

    return () => {
      stopPlayback();
    };
  }, []);

  function stopPlayback() {
    isCancelledRef.current = true;
    setLoadingAudio(false);

    // Stop ElevenLabs HTML5 Audio
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current.currentTime = 0;
      audioPlayerRef.current = null;
    }

    // Stop Browser speech
    if (keepAliveTimerRef.current) {
      clearInterval(keepAliveTimerRef.current);
      keepAliveTimerRef.current = null;
    }
    if (typeof window !== "undefined" && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {}
    }

    setIsPlaying(false);
    setTtsEngine(null);
  }

  function startBrowserSpeech(scriptToRead: string) {
    try {
      const chunks = scriptToRead.match(/[^.!?]+[.!?]+(\s+|$)|[^.!?]+$/g) || [scriptToRead];
      sentencesRef.current = chunks;
      currentSentenceIdxRef.current = 0;

      keepAliveTimerRef.current = setInterval(() => {
        if (typeof window !== "undefined" && window.speechSynthesis?.speaking) {
          window.speechSynthesis.pause();
          window.speechSynthesis.resume();
        }
      }, 6000);

      setIsPlaying(true);
      setTtsEngine("browser");
      speakNextSentence();
    } catch (err: any) {
      setError(err?.message || "Audio playback unavailable.");
      setIsPlaying(false);
    }
  }

  function speakNextSentence() {
    if (isCancelledRef.current) return;
    if (currentSentenceIdxRef.current >= sentencesRef.current.length) {
      setIsPlaying(false);
      setTtsEngine(null);
      if (keepAliveTimerRef.current) {
        clearInterval(keepAliveTimerRef.current);
        keepAliveTimerRef.current = null;
      }
      return;
    }

    const sentence = sentencesRef.current[currentSentenceIdxRef.current].trim();
    if (!sentence) {
      currentSentenceIdxRef.current++;
      speakNextSentence();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(sentence);
    utterance.rate = speechRate;
    utterance.pitch = 1.0;

    const chosenVoice = voices.find((v) => v.name === selectedVoiceName) || voices[0];
    if (chosenVoice) {
      utterance.voice = chosenVoice;
    }

    utterance.onend = () => {
      currentSentenceIdxRef.current++;
      speakNextSentence();
    };

    utterance.onerror = (e) => {
      if (e.error !== "canceled" && e.error !== "interrupted") {
        setError(`Speech error: ${e.error}`);
        stopPlayback();
      }
    };

    window.speechSynthesis.speak(utterance);
  }

  async function handlePlay() {
    if (!digest) return;

    if (isPlaying || loadingAudio) {
      stopPlayback();
      return;
    }

    stopPlayback();
    isCancelledRef.current = false;
    setError(null);

    const scriptToRead = constructDigestSpeechScript(digest);

    // 1. First, check if ElevenLabs TTS is available via /api/tts
    setLoadingAudio(true);
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: scriptToRead }),
      });

      if (res.ok) {
        const contentType = res.headers.get("content-type") || "";
        if (contentType.includes("audio")) {
          const blob = await res.blob();
          const audioUrl = URL.createObjectURL(blob);
          const audio = new Audio(audioUrl);
          audioPlayerRef.current = audio;
          audio.playbackRate = speechRate;

          audio.onended = () => {
            setIsPlaying(false);
            setTtsEngine(null);
          };

          audio.onerror = () => {
            stopPlayback();
            startBrowserSpeech(scriptToRead);
          };

          await audio.play();
          setLoadingAudio(false);
          setIsPlaying(true);
          setTtsEngine("elevenlabs");
          return;
        }
      }
    } catch (e) {
      // ElevenLabs API key not set or network blocked; continue to browser fallback
    }

    setLoadingAudio(false);

    // 2. Seamlessly use Browser Google TTS
    startBrowserSpeech(scriptToRead);
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

  const script = constructDigestSpeechScript(digest);
  const activeVoice = voices.find((v) => v.name === selectedVoiceName);

  return (
    <div className="bg-gradient-to-br from-white via-white to-[#faf3ee] border border-[#f0e3d8] rounded-3xl p-5 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#faf3ee] border border-[#f0e3d8] text-[#c2593f] flex items-center justify-center text-lg font-bold shadow-xs">
            📻
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-base text-[#27221d]">Family Daily Digest</h3>
              <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-[#f3eae4] text-[#c2593f]">
                {digest.generatedBy === "gemma" ? "Gemma ✦" : "Detailed Audio"}
              </span>

              {ttsEngine === "elevenlabs" && (
                <span className="text-[10px] font-semibold uppercase px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1 shadow-2xs">
                  <span>✦</span> ElevenLabs Lifelike AI Voice
                </span>
              )}

              {ttsEngine === "browser" && (
                <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  Google TTS
                </span>
              )}

              {isPlaying && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#c2593f] bg-red-50 border border-red-200 px-2 py-0.5 rounded-full animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#c2593f]" />
                  Playing Aloud
                </span>
              )}
            </div>
            <p className="text-xs text-[#6e655f] mt-0.5">{digest.headline}</p>
          </div>
        </div>

        {/* Audio Listen Button */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePlay}
            disabled={loadingAudio}
            className={`px-4 py-2 rounded-2xl text-white shadow-sm font-semibold text-xs transition flex items-center gap-2 shrink-0 ${
              isPlaying
                ? "bg-[#27221d] hover:bg-black"
                : "bg-[#c2593f] hover:bg-[#aa4a32]"
            }`}
          >
            {loadingAudio ? (
              <>
                <span className="animate-spin text-sm">⟳</span>
                <span>Generating Voice...</span>
              </>
            ) : isPlaying ? (
              <>
                <span>⏹</span>
                <span>Stop Listening</span>
              </>
            ) : (
              <>
                <span>▶</span>
                <span>Listen to today&apos;s digest</span>
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center justify-between">
          <span>{error}</span>
          <span className="text-[10px] font-semibold text-amber-900 uppercase">Text Available</span>
        </div>
      )}

      {/* Voice Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-[#faf6f2] border border-[#ede7df] rounded-2xl text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-semibold text-[#6e655f] uppercase tracking-wider">
            Audio Voice:
          </span>
          <select
            value={selectedVoiceName}
            onChange={(e) => {
              setSelectedVoiceName(e.target.value);
              if (isPlaying) stopPlayback();
            }}
            className="text-xs py-1 px-2.5 rounded-xl bg-white border border-[#ede7df] text-[#27221d] font-medium outline-hidden"
          >
            <option value="elevenlabs-rachel">✦ ElevenLabs Rachel (Lifelike Studio Voice)</option>
            {voices
              .filter((v) => v.lang.startsWith("en") || v.name.includes("Google"))
              .map((v, i) => (
                <option key={i} value={v.name}>
                  {v.name.includes("Google") ? `Google TTS - ${v.name}` : v.name} ({v.lang})
                </option>
              ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-[#6e655f]">Speed:</span>
          <select
            value={speechRate}
            onChange={(e) => {
              const rate = parseFloat(e.target.value);
              setSpeechRate(rate);
              if (audioPlayerRef.current) {
                audioPlayerRef.current.playbackRate = rate;
              }
            }}
            className="text-xs py-1 px-2 rounded-xl bg-white border border-[#ede7df] text-[#27221d] font-medium outline-hidden"
          >
            <option value="0.85">0.85x (Relaxed)</option>
            <option value="0.95">0.95x (Natural)</option>
            <option value="1.0">1.0x (Standard)</option>
            <option value="1.15">1.15x (Brisk)</option>
          </select>
        </div>
      </div>

      {/* Spoken Script Accordion */}
      <div className="bg-[#faf6f2]/80 border border-[#ede7df] rounded-2xl p-3 text-xs space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-[#6e655f] flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
            <span>🗣️ Spoken Digest Script</span>
            {isPlaying && (
              <span className="text-[#c2593f] text-xs font-normal italic animate-pulse">
                — {ttsEngine === "elevenlabs" ? "Narrating via ElevenLabs" : "Speaking now"}
              </span>
            )}
          </span>
          <button
            onClick={() => setShowScript(!showScript)}
            className="text-[11px] font-semibold text-[#c2593f] hover:underline"
          >
            {showScript ? "Hide text" : "Show script"}
          </button>
        </div>
        {showScript && (
          <p className="text-[#27221d] italic text-xs leading-relaxed border-t border-[#ede7df]/80 pt-2 animate-in fade-in">
            &ldquo;{script}&rdquo;
          </p>
        )}
      </div>

      {/* Sections Summary Cards */}
      {digest.sections.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1 border-t border-[#ede7df]/60">
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
        <span>Powered by Gemma, ElevenLabs &amp; Google Speech</span>
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
