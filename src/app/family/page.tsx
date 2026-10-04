"use client";

import { useEffect, useState } from "react";
import type { MemberDTO, MeDTO } from "@/lib/types";

export default function FamilySettingsPage() {
  const [me, setMe] = useState<MeDTO | null>(null);
  const [members, setMembers] = useState<MemberDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState("");
  const [relation, setRelation] = useState("");
  const [birthday, setBirthday] = useState("");
  const [color, setColor] = useState("#4f46e5");
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [meRes, membersRes] = await Promise.all([
        fetch("/api/auth/me"),
        fetch("/api/family/members"),
      ]);
      if (meRes.ok) setMe(await meRes.json());
      if (membersRes.ok) setMembers(await membersRes.json());
    } catch (err) {
      console.error("Family settings load error:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || saving) return;

    setSaving(true);
    try {
      const res = await fetch("/api/family/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), relation, birthday, color }),
      });
      if (res.ok) {
        setName("");
        setRelation("");
        setBirthday("");
        setShowAddForm(false);
        loadData();
      }
    } catch (err) {
      console.error("Add member error:", err);
    } finally {
      setSaving(false);
    }
  }

  function copyInvite() {
    if (me?.family?.inviteCode) {
      navigator.clipboard.writeText(me.family.inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#27221d] tracking-tight">Family Settings</h1>
          <p className="text-xs text-[#6e655f] mt-0.5">Manage family members and invite family to join</p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-4 py-2 rounded-xl bg-[#c2593f] text-white font-semibold text-xs hover:bg-[#aa4a32] shadow-xs transition"
        >
          {showAddForm ? "Cancel" : "+ Add Member"}
        </button>
      </div>

      {/* Family Info & Invite Card */}
      {me?.family && (
        <div className="bg-white rounded-3xl p-6 border border-[#ede7df] shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-bold text-[#c2593f] uppercase tracking-wider">Family Group</span>
              <h2 className="text-xl font-bold text-[#27221d]">{me.family.name}</h2>
              <p className="text-xs text-[#6e655f] mt-0.5">Timezone: {me.family.timezone}</p>
            </div>

            <div className="flex items-center gap-3 bg-[#faf3ee] p-3 rounded-2xl border border-[#f0e3d8]">
              <div>
                <span className="text-[10px] font-bold text-[#6e655f] uppercase tracking-wider block">Invite Code</span>
                <span className="text-sm font-mono font-bold text-[#c2593f]">{me.family.inviteCode}</span>
              </div>
              <button
                onClick={copyInvite}
                className="px-3 py-1.5 rounded-xl bg-white border border-[#ede7df] text-xs font-semibold text-[#27221d] hover:bg-[#faf8f5] transition shadow-2xs"
              >
                {copied ? "✓ Copied!" : "Copy Code"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Member Form */}
      {showAddForm && (
        <form onSubmit={handleAddMember} className="bg-white rounded-3xl p-6 border border-[#ede7df] shadow-xs space-y-4 animate-in fade-in">
          <h3 className="font-bold text-sm text-[#27221d]">Add Family Member</h3>
          <p className="text-xs text-[#6e655f]">You can add anyone in your household even if they don&apos;t have an email address.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-[#27221d] mb-1">Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Dadi, Rohan, Priya"
                className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-[#ede7df] focus:border-[#c2593f] outline-hidden"
              />
            </div>
            <div>
              <label className="block font-semibold text-[#27221d] mb-1">Relation</label>
              <input
                type="text"
                value={relation}
                onChange={(e) => setRelation(e.target.value)}
                placeholder="e.g. Grandmother, Son, Sister"
                className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-[#ede7df] focus:border-[#c2593f] outline-hidden"
              />
            </div>
            <div>
              <label className="block font-semibold text-[#27221d] mb-1">Birthday (Optional)</label>
              <input
                type="date"
                value={birthday}
                onChange={(e) => setBirthday(e.target.value)}
                className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-[#ede7df] focus:border-[#c2593f] outline-hidden"
              />
            </div>
            <div>
              <label className="block font-semibold text-[#27221d] mb-1">Badge Color</label>
              <select
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-[#ede7df] focus:border-[#c2593f] outline-hidden bg-white"
              >
                <option value="#4f46e5">Indigo</option>
                <option value="#059669">Emerald</option>
                <option value="#c2593f">Terracotta</option>
                <option value="#d97706">Amber</option>
                <option value="#e11d48">Rose</option>
                <option value="#0891b2">Cyan</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 rounded-xl text-xs font-medium text-[#6e655f] hover:bg-[#f6f2ec]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-[#c2593f] text-white text-xs font-semibold hover:bg-[#aa4a32] shadow-xs"
            >
              {saving ? "Saving..." : "Add Member"}
            </button>
          </div>
        </form>
      )}

      {/* Members Grid */}
      <div className="space-y-3">
        <h3 className="font-bold text-sm text-[#27221d]">Family Members ({members.length})</h3>
        {loading ? (
          <div className="py-8 text-center text-xs text-[#6e655f]">Loading members...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {members.map((m) => (
              <div
                key={m.id}
                className="bg-white rounded-3xl p-5 border border-[#ede7df] shadow-2xs flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-2xl text-white font-bold text-sm flex items-center justify-center shadow-xs"
                    style={{ backgroundColor: m.color }}
                  >
                    {m.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-[#27221d]">{m.name}</h4>
                      {m.isYou && (
                        <span className="text-[10px] font-bold text-[#c2593f] bg-[#faf3ee] px-2 py-0.5 rounded-full border border-[#f0e3d8]">
                          You
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#6e655f]">{m.relation || "Family Member"}</p>
                  </div>
                </div>

                <div className="text-right text-[11px] text-[#6e655f]">
                  {m.birthday && <p>🎂 {m.birthday}</p>}
                  <p className="mt-0.5">{m.hasAccount ? "Signed up" : "Shared profile"}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
