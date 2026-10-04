"use client";

import { useEffect, useState } from "react";
import type { MemoryDTO, MemoryCategoryDTO } from "@/lib/types";

const CATEGORIES: { label: string; value: string }[] = [
  { label: "All Memories", value: "all" },
  { label: "Preferences", value: "preference" },
  { label: "Family / People", value: "person" },
  { label: "Decisions", value: "decision" },
  { label: "Household", value: "household" },
  { label: "Recurring Notes", value: "recurring" },
  { label: "Other", value: "miscellaneous" },
];

export default function MemoriesPage() {
  const [memories, setMemories] = useState<MemoryDTO[]>([]);
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [content, setContent] = useState("");
  const [selectedCat, setSelectedCat] = useState<MemoryCategoryDTO>("preference");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadMemories();
  }, [category, search]);

  async function loadMemories() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (category !== "all") params.set("category", category);
      if (search.trim()) params.set("query", search.trim());

      const res = await fetch(`/api/memories?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setMemories(data);
      }
    } catch (err) {
      console.error("Memories fetch error:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddMemory(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim() || saving) return;

    setSaving(true);
    try {
      const res = await fetch("/api/memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.trim(), category: selectedCat }),
      });
      if (res.ok) {
        setContent("");
        setShowAddForm(false);
        loadMemories();
      }
    } catch (err) {
      console.error("Add memory error:", err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteMemory(id: string) {
    if (!confirm("Remove this memory from family storage?")) return;
    try {
      await fetch(`/api/memories/${id}`, { method: "DELETE" });
      loadMemories();
    } catch (err) {
      console.error("Delete memory error:", err);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#27221d] tracking-tight">Family Memory</h1>
          <p className="text-xs text-[#6e655f] mt-0.5">Explicit, searchable preferences, decisions, and household notes</p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-4 py-2 rounded-xl bg-[#c2593f] text-white font-semibold text-xs hover:bg-[#aa4a32] shadow-xs transition flex items-center gap-1.5"
        >
          <span>{showAddForm ? "Cancel" : "+ Save Memory"}</span>
        </button>
      </div>

      {/* Category Pills & Search */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              onClick={() => setCategory(c.value)}
              className={`px-3 py-1.5 rounded-full font-semibold whitespace-nowrap transition ${
                category === c.value
                  ? "bg-[#faf3ee] text-[#c2593f] border border-[#f0e3d8]"
                  : "bg-white text-[#6e655f] border border-[#ede7df] hover:border-[#c2593f]"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search memory..."
          className="text-xs px-3.5 py-2 rounded-xl bg-white border border-[#ede7df] focus:border-[#c2593f] outline-hidden w-full md:w-56"
        />
      </div>

      {showAddForm && (
        <form onSubmit={handleAddMemory} className="bg-white rounded-3xl p-6 border border-[#ede7df] shadow-xs space-y-4 animate-in fade-in">
          <h3 className="font-bold text-sm text-[#27221d]">Save Family Memory</h3>
          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-semibold text-[#27221d] mb-1">Fact to remember *</label>
              <textarea
                rows={3}
                required
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="e.g. 'Dad doesn't like spicy food', 'WiFi password is ...', 'Mom prefers morning flights'"
                className="w-full text-sm p-3 rounded-xl border border-[#ede7df] focus:border-[#c2593f] outline-hidden resize-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-[#27221d] mb-1">Category</label>
              <select
                value={selectedCat}
                onChange={(e) => setSelectedCat(e.target.value as MemoryCategoryDTO)}
                className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-[#ede7df] focus:border-[#c2593f] outline-hidden bg-white"
              >
                <option value="preference">Preference</option>
                <option value="person">Person / Family Member</option>
                <option value="decision">Decision</option>
                <option value="household">Household Info</option>
                <option value="recurring">Recurring Note</option>
                <option value="miscellaneous">Other</option>
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
              {saving ? "Saving..." : "Save Memory"}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="py-12 text-center text-xs text-[#6e655f]">Searching memories...</div>
      ) : memories.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-[#ede7df] space-y-2">
          <span className="text-3xl">💡</span>
          <h3 className="font-bold text-sm text-[#27221d]">No memories found</h3>
          <p className="text-xs text-[#6e655f] max-w-sm mx-auto">
            Save family preferences, notes, or decisions here so Kutumb can always remember them accurately.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {memories.map((m) => (
            <div
              key={m.id}
              className="bg-white rounded-3xl p-5 border border-[#ede7df] shadow-2xs space-y-2 relative group hover:border-[#c2593f]/40 transition"
            >
              <div className="flex items-start justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#faf3ee] text-[#c2593f] border border-[#f0e3d8]">
                  {m.category}
                </span>
                <button
                  onClick={() => handleDeleteMemory(m.id)}
                  title="Remove memory"
                  className="text-xs text-[#6e655f] hover:text-red-600 opacity-60 group-hover:opacity-100 transition p-1"
                >
                  ✕
                </button>
              </div>
              <p className="text-sm font-medium text-[#27221d] leading-relaxed">
                {m.content}
              </p>
              <p className="text-[10px] text-[#6e655f] pt-1">
                Source: {m.source === "assistant" ? "Gemma Conversation" : m.source === "voice" ? "Voice Note" : "Manual Note"}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
