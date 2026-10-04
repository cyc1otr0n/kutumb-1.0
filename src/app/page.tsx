"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AskKutumbBar } from "@/components/AskKutumbBar";
import { AudioDigestPlayer } from "@/components/AudioDigestPlayer";
import type { HomeDTO, DigestDTO } from "@/lib/types";

export default function HomePage() {
  const [data, setData] = useState<HomeDTO | null>(null);
  const [digest, setDigest] = useState<DigestDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    loadHomeData();
  }, []);

  async function loadHomeData() {
    setLoading(true);
    try {
      const res = await fetch("/api/home");
      if (res.status === 401) {
        setNeedsAuth(true);
        setLoading(false);
        return;
      }
      if (res.status === 403) {
        setNeedsOnboarding(true);
        setLoading(false);
        return;
      }
      if (!res.ok) throw new Error("Failed to load home data");

      const homeData: HomeDTO = await res.json();
      setData(homeData);

      // Fetch latest digest
      const digestRes = await fetch("/api/digest");
      if (digestRes.ok) {
        const digestData: DigestDTO = await digestRes.json();
        setDigest(digestData);
      }
    } catch (err) {
      console.error("Home loading error:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCompleteTask(taskId: string) {
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete" }),
      });
      loadHomeData();
    } catch (err) {
      console.error("Task complete error:", err);
    }
  }

  async function handleRefreshDigest() {
    try {
      const res = await fetch("/api/digest", { method: "POST" });
      if (res.ok) {
        const newDigest = await res.json();
        setDigest(newDigest);
      }
    } catch (err) {
      console.error("Digest refresh error:", err);
    }
  }

  if (loading) {
    return (
      <div className="py-24 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-[#faf3ee] text-[#c2593f] flex items-center justify-center text-xl font-bold mx-auto border border-[#ede7df] animate-pulse">
          कु
        </div>
        <p className="text-sm font-medium text-[#6e655f]">Gathering your family&apos;s updates...</p>
      </div>
    );
  }

  if (needsAuth) {
    return (
      <div className="py-16 max-w-lg mx-auto text-center space-y-6">
        <div className="w-16 h-16 rounded-3xl bg-[#faf3ee] text-[#c2593f] flex items-center justify-center text-3xl font-bold mx-auto border border-[#ede7df] shadow-sm">
          कु
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-[#27221d] tracking-tight">Kutumb</h1>
          <p className="text-base text-[#6e655f] leading-relaxed">
            Your family&apos;s shared memory and coordination layer. One place to remember what you keep forgetting.
          </p>
        </div>
        <div className="flex items-center justify-center gap-3 pt-2">
          <Link
            href="/login"
            className="px-6 py-2.5 rounded-xl border border-[#ede7df] text-sm font-semibold text-[#27221d] hover:bg-[#f6f2ec] transition"
          >
            Sign In
          </Link>
          <Link
            href="/register"
            className="px-6 py-2.5 rounded-xl bg-[#c2593f] text-white text-sm font-semibold hover:bg-[#aa4a32] shadow-sm transition"
          >
            Get Started
          </Link>
        </div>
      </div>
    );
  }

  if (needsOnboarding) {
    return (
      <div className="py-16 max-w-md mx-auto text-center space-y-6">
        <span className="w-16 h-16 rounded-3xl bg-[#faf3ee] text-[#c2593f] inline-flex items-center justify-center text-3xl font-bold">
          🏡
        </span>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-[#27221d]">Join or Create Your Family</h2>
          <p className="text-sm text-[#6e655f]">
            You&apos;re signed in, but you haven&apos;t joined a family group yet.
          </p>
        </div>
        <Link
          href="/onboarding"
          className="inline-block px-8 py-3 rounded-2xl bg-[#c2593f] text-white font-semibold text-sm hover:bg-[#aa4a32] shadow-sm transition"
        >
          Set Up Family Now
        </Link>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-8 pb-12">
      {/* 1. Header Greeting & Ask Kutumb */}
      <section className="space-y-4">
        <div className="flex items-baseline justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-[#27221d] tracking-tight">
              {data.greeting}, {data.userName}
            </h1>
            <p className="text-xs text-[#6e655f] mt-0.5 font-medium">{data.todayLabel}</p>
          </div>
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-[#faf3ee] text-[#c2593f] border border-[#f0e3d8]">
            {data.familyName}
          </span>
        </div>

        {/* The Ask Kutumb Bar with Voice & Pills */}
        <AskKutumbBar onDataChanged={loadHomeData} />
      </section>

      {/* 2. Audio Family Digest (Web Speech TTS + Gemma summary) */}
      <section>
        <AudioDigestPlayer digest={digest} onRefresh={handleRefreshDigest} />
      </section>

      {/* 3. Main Dashboard Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column: Today's Schedule + Upcoming Events */}
        <div className="space-y-6">
          {/* Today's Events */}
          <div className="bg-white border border-[#ede7df] rounded-3xl p-5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-xl bg-[#faf3ee] text-[#c2593f] flex items-center justify-center text-xs font-bold">
                  📅
                </span>
                <h3 className="font-bold text-sm text-[#27221d]">Today&apos;s Plans</h3>
              </div>
              <Link href="/events" className="text-xs font-semibold text-[#c2593f] hover:underline">
                View All
              </Link>
            </div>

            {data.today.length === 0 ? (
              <p className="text-xs text-[#6e655f] py-4 text-center italic bg-[#faf8f5] rounded-2xl border border-dashed border-[#ede7df]">
                Nothing scheduled for today. Enjoy your day!
              </p>
            ) : (
              <div className="space-y-2">
                {data.today.map((e) => (
                  <div
                    key={e.id}
                    className="p-3 bg-[#faf8f5] rounded-2xl border border-[#ede7df] flex items-center justify-between gap-3 hover:border-[#c2593f]/40 transition"
                  >
                    <div>
                      <h4 className="font-semibold text-xs text-[#27221d]">{e.title}</h4>
                      {e.location && (
                        <p className="text-[11px] text-[#6e655f] mt-0.5">📍 {e.location}</p>
                      )}
                    </div>
                    <span className="text-xs font-mono font-bold text-[#c2593f] shrink-0 bg-white px-2 py-1 rounded-lg border border-[#ede7df]">
                      {e.timeLabel || "All day"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Upcoming Events */}
          {data.upcoming.length > 0 && (
            <div className="bg-white border border-[#ede7df] rounded-3xl p-5 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-xl bg-[#faf3ee] text-[#c2593f] flex items-center justify-center text-xs font-bold">
                    🔜
                  </span>
                  <h3 className="font-bold text-sm text-[#27221d]">Coming Up Soon</h3>
                </div>
                <Link href="/events" className="text-xs font-semibold text-[#c2593f] hover:underline">
                  Full Calendar
                </Link>
              </div>

              <div className="space-y-2">
                {data.upcoming.map((e) => (
                  <div
                    key={e.id}
                    className="p-3 bg-white rounded-2xl border border-[#ede7df] flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <span className="font-semibold text-[#27221d]">{e.title}</span>
                    </div>
                    <span className="text-[11px] text-[#6e655f] font-medium shrink-0 bg-[#faf8f5] px-2 py-0.5 rounded-md">
                      {e.dayLabel} {e.timeLabel ? `· ${e.timeLabel}` : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Scheduled Reminders (Temporal Durable Reminders) */}
          {data.reminders.length > 0 && (
            <div className="bg-white border border-[#ede7df] rounded-3xl p-5 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-xs font-bold border border-amber-200">
                    🔔
                  </span>
                  <h3 className="font-bold text-sm text-[#27221d]">Active Reminders</h3>
                </div>
                <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full font-semibold border border-amber-200">
                  Temporal Durable
                </span>
              </div>

              <div className="space-y-2">
                {data.reminders.map((r) => (
                  <div
                    key={r.id}
                    className="p-3 bg-amber-50/50 rounded-2xl border border-amber-100 flex items-start justify-between gap-3 text-xs"
                  >
                    <div>
                      <span className="font-medium text-[#27221d]">&ldquo;{r.message}&rdquo;</span>
                      <p className="text-[10px] text-[#6e655f] mt-0.5">Audience: {r.audience}</p>
                    </div>
                    <span className="text-[11px] font-semibold text-amber-800 shrink-0">
                      {r.fireLabel}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Family Updates & Open Tasks */}
        <div className="space-y-6">
          {/* Recent Family Updates */}
          <div className="bg-white border border-[#ede7df] rounded-3xl p-5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-xl bg-[#faf3ee] text-[#c2593f] flex items-center justify-center text-xs font-bold">
                  💬
                </span>
                <h3 className="font-bold text-sm text-[#27221d]">Family Updates</h3>
              </div>
              <Link href="/updates" className="text-xs font-semibold text-[#c2593f] hover:underline">
                Post Update
              </Link>
            </div>

            {data.updates.length === 0 ? (
              <p className="text-xs text-[#6e655f] py-4 text-center italic bg-[#faf8f5] rounded-2xl border border-dashed border-[#ede7df]">
                No updates shared yet today.
              </p>
            ) : (
              <div className="space-y-2.5">
                {data.updates.map((u) => (
                  <div
                    key={u.id}
                    className="p-3.5 bg-[#faf8f5] rounded-2xl border border-[#ede7df] space-y-1 hover:border-[#c2593f]/30 transition"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-[#27221d]">{u.authorName}</span>
                      <span className="text-[10px] text-[#6e655f] uppercase tracking-wider">
                        {u.source === "voice" ? "🎙️ Voice" : u.source === "reminder" ? "🔔 Reminder" : "Text"}
                      </span>
                    </div>
                    <p className="text-xs text-[#27221d] leading-relaxed">{u.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Open Family Tasks */}
          <div className="bg-white border border-[#ede7df] rounded-3xl p-5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-xl bg-[#faf3ee] text-[#c2593f] flex items-center justify-center text-xs font-bold">
                  ✓
                </span>
                <h3 className="font-bold text-sm text-[#27221d]">Family Tasks</h3>
              </div>
              <Link href="/tasks" className="text-xs font-semibold text-[#c2593f] hover:underline">
                Manage All
              </Link>
            </div>

            {data.openTasks.length === 0 ? (
              <p className="text-xs text-[#6e655f] py-4 text-center italic bg-[#faf8f5] rounded-2xl border border-dashed border-[#ede7df]">
                All family tasks are completed!
              </p>
            ) : (
              <div className="space-y-2">
                {data.openTasks.slice(0, 5).map((t) => (
                  <div
                    key={t.id}
                    className="p-3 bg-[#faf8f5] rounded-2xl border border-[#ede7df] flex items-center justify-between gap-3 text-xs hover:border-[#c2593f]/30 transition"
                  >
                    <div className="flex items-center gap-2.5">
                      <button
                        onClick={() => handleCompleteTask(t.id)}
                        title="Mark as completed"
                        className="w-4 h-4 rounded-md border-2 border-[#6e655f] hover:border-[#c2593f] hover:bg-[#c2593f]/10 transition shrink-0"
                      />
                      <div>
                        <span className="font-semibold text-[#27221d]">{t.title}</span>
                        {t.assigneeName && (
                          <span className="ml-2 text-[10px] text-[#6e655f] bg-white px-2 py-0.5 rounded-full border border-[#ede7df]">
                            👤 {t.assigneeName}
                          </span>
                        )}
                      </div>
                    </div>
                    {t.dueLabel && (
                      <span className="text-[11px] font-medium text-[#c2593f] shrink-0">
                        {t.dueLabel}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
