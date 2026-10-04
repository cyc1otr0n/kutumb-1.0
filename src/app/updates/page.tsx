"use client";

import { useEffect, useState } from "react";
import type { UpdateDTO } from "@/lib/types";

export default function UpdatesPage() {
  const [updates, setUpdates] = useState<UpdateDTO[]>([]);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    loadUpdates();
  }, []);

  async function loadUpdates() {
    setLoading(true);
    try {
      const res = await fetch("/api/updates");
      if (res.ok) {
        const data = await res.json();
        setUpdates(data);
      }
    } catch (err) {
      console.error("Updates fetch error:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handlePost(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim() || posting) return;

    setPosting(true);
    try {
      const res = await fetch("/api/updates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.trim() }),
      });
      if (res.ok) {
        setContent("");
        loadUpdates();
      }
    } catch (err) {
      console.error("Post update error:", err);
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 py-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-[#27221d] tracking-tight">Family Updates</h1>
        <p className="text-xs text-[#6e655f]">
          Quick announcements, changes in plans, and notes shared with everyone in the family
        </p>
      </div>

      {/* Post new update box */}
      <form onSubmit={handlePost} className="bg-white rounded-3xl p-5 border border-[#ede7df] shadow-xs space-y-3">
        <textarea
          rows={3}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Share an update with your family... e.g. 'Dinner is now at 7 instead of 6', or 'Leaving for the airport soon!'"
          className="w-full text-sm p-3 rounded-2xl border border-[#ede7df] focus:border-[#c2593f] focus:ring-2 focus:ring-[#c2593f]/10 outline-hidden resize-none"
        />
        <div className="flex items-center justify-between pt-1">
          <span className="text-[11px] text-[#6e655f]">Visible to everyone in your family group</span>
          <button
            type="submit"
            disabled={!content.trim() || posting}
            className="px-5 py-2 rounded-xl bg-[#c2593f] text-white text-xs font-semibold hover:bg-[#aa4a32] shadow-xs transition disabled:opacity-40"
          >
            {posting ? "Posting..." : "Share Update"}
          </button>
        </div>
      </form>

      {/* Updates Stream */}
      {loading ? (
        <div className="py-12 text-center text-xs text-[#6e655f]">Loading updates...</div>
      ) : updates.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-[#ede7df] space-y-2">
          <span className="text-3xl">💬</span>
          <h3 className="font-bold text-sm text-[#27221d]">No family updates yet</h3>
          <p className="text-xs text-[#6e655f] max-w-sm mx-auto">
            Post an announcement above or speak a voice note from the Home screen.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {updates.map((u) => (
            <div
              key={u.id}
              className="bg-white rounded-3xl p-5 border border-[#ede7df] shadow-2xs space-y-2 hover:border-[#c2593f]/30 transition"
            >
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-[#faf3ee] text-[#c2593f] font-bold text-xs flex items-center justify-center border border-[#ede7df]">
                    {u.authorName.charAt(0).toUpperCase()}
                  </div>
                  <span className="font-bold text-[#27221d]">{u.authorName}</span>
                </div>
                <div className="flex items-center gap-2 text-[#6e655f] text-[11px]">
                  <span className="px-2 py-0.5 rounded-full bg-[#faf8f5] border border-[#ede7df]">
                    {u.source === "voice" ? "🎙️ Spoken" : u.source === "reminder" ? "🔔 Reminder" : "Text"}
                  </span>
                  <span>{new Date(u.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
                </div>
              </div>
              <p className="text-sm text-[#27221d] leading-relaxed whitespace-pre-line pl-9">
                {u.content}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
