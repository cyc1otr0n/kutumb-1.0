"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function OnboardingPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"create" | "join">("create");
  const [familyName, setFamilyName] = useState("");
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [inviteCode, setInviteCode] = useState("");
  const [relation, setRelation] = useState("Member");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreateFamily(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/family", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", name: familyName, timezone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Failed to create family");

      router.push("/");
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Could not create family");
    } finally {
      setLoading(false);
    }
  }

  async function handleJoinFamily(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/family", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "join", inviteCode, relation }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Failed to join family");

      router.push("/");
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Could not join family");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto py-12 px-4">
      <div className="bg-white rounded-3xl p-8 border border-[#ede7df] shadow-sm space-y-6">
        <div className="text-center space-y-2">
          <span className="w-12 h-12 rounded-2xl bg-[#faf3ee] text-[#c2593f] inline-flex items-center justify-center font-bold text-xl shadow-2xs">
            🏡
          </span>
          <h2 className="text-2xl font-bold text-[#27221d]">Set up your Family</h2>
          <p className="text-xs text-[#6e655f]">Every event, task, and memory belongs to your private family group</p>
        </div>

        {/* Tab switch: Create vs Join */}
        <div className="grid grid-cols-2 p-1 bg-[#faf8f5] rounded-2xl border border-[#ede7df]">
          <button
            type="button"
            onClick={() => setTab("create")}
            className={`py-2 text-xs font-bold rounded-xl transition ${
              tab === "create" ? "bg-white text-[#c2593f] shadow-xs" : "text-[#6e655f]"
            }`}
          >
            Create New Family
          </button>
          <button
            type="button"
            onClick={() => setTab("join")}
            className={`py-2 text-xs font-bold rounded-xl transition ${
              tab === "join" ? "bg-white text-[#c2593f] shadow-xs" : "text-[#6e655f]"
            }`}
          >
            Join with Invite Code
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
            {error}
          </div>
        )}

        {tab === "create" ? (
          <form onSubmit={handleCreateFamily} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#27221d] mb-1">Family Name</label>
              <input
                type="text"
                required
                value={familyName}
                onChange={(e) => setFamilyName(e.target.value)}
                placeholder="e.g. The Sharma Family"
                className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-[#ede7df] focus:border-[#c2593f] focus:ring-2 focus:ring-[#c2593f]/10 outline-hidden transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#27221d] mb-1">Home Timezone</label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-[#ede7df] focus:border-[#c2593f] focus:ring-2 focus:ring-[#c2593f]/10 outline-hidden transition bg-white"
              >
                <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                <option value="America/New_York">America/New_York (EST/EDT)</option>
                <option value="America/Los_Angeles">America/Los_Angeles (PST/PDT)</option>
                <option value="America/Chicago">America/Chicago (CST/CDT)</option>
                <option value="Europe/London">Europe/London (GMT/BST)</option>
                <option value="Asia/Dubai">Asia/Dubai (GST)</option>
                <option value="Asia/Singapore">Asia/Singapore (SGT)</option>
                <option value="UTC">UTC</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-[#c2593f] text-white font-semibold text-sm hover:bg-[#aa4a32] shadow-sm transition disabled:opacity-50"
            >
              {loading ? "Creating family..." : "Create Family Group"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleJoinFamily} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#27221d] mb-1">Invite Code</label>
              <input
                type="text"
                required
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                placeholder="e.g. KUTUMB-AB12CD"
                className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-[#ede7df] focus:border-[#c2593f] focus:ring-2 focus:ring-[#c2593f]/10 outline-hidden transition uppercase font-mono"
              />
              <p className="text-[11px] text-[#6e655f] mt-1">Ask the family member who created the group for their code</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#27221d] mb-1">Your Relationship</label>
              <input
                type="text"
                value={relation}
                onChange={(e) => setRelation(e.target.value)}
                placeholder="e.g. Son, Daughter, Mother, Spouse"
                className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-[#ede7df] focus:border-[#c2593f] focus:ring-2 focus:ring-[#c2593f]/10 outline-hidden transition"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-[#c2593f] text-white font-semibold text-sm hover:bg-[#aa4a32] shadow-sm transition disabled:opacity-50"
            >
              {loading ? "Joining family..." : "Join Family Group"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
