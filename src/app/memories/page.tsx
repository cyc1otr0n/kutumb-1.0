"use client";

import { useEffect, useState, useRef } from "react";
import type { MemoryDTO, MemoryCategoryDTO, MemoryAttachmentDTO } from "@/lib/types";

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
  const [attachments, setAttachments] = useState<MemoryAttachmentDTO[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  function handleFileSelect(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploadError(null);

    const allowedTypes = ["image/jpeg", "image/png", "image/jpg", "application/pdf"];
    const maxSizeBytes = 6 * 1024 * 1024; // 6MB limit

    Array.from(files).forEach((file) => {
      const isAllowed =
        allowedTypes.includes(file.type.toLowerCase()) ||
        file.name.toLowerCase().endsWith(".pdf") ||
        file.name.toLowerCase().endsWith(".jpg") ||
        file.name.toLowerCase().endsWith(".jpeg") ||
        file.name.toLowerCase().endsWith(".png");

      if (!isAllowed) {
        setUploadError(`File "${file.name}" is not supported. Please select JPG, PNG, or PDF.`);
        return;
      }

      if (file.size > maxSizeBytes) {
        setUploadError(`File "${file.name}" exceeds the 6MB limit.`);
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const resultUrl = e.target?.result as string;
        if (!resultUrl) return;

        const effectiveType = file.type || (file.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg");
        setAttachments((prev) => [
          ...prev,
          {
            url: resultUrl,
            fileName: file.name,
            fileType: effectiveType,
            fileSize: file.size,
          },
        ]);
      };
      reader.onerror = () => {
        setUploadError(`Failed to read "${file.name}". Please try another file.`);
      };
      reader.readAsDataURL(file);
    });
  }

  function removeAttachment(index: number) {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleAddMemory(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim() || saving) return;

    setSaving(true);
    try {
      const res = await fetch("/api/memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content.trim(),
          category: selectedCat,
          attachments,
        }),
      });

      if (res.ok) {
        setContent("");
        setAttachments([]);
        setUploadError(null);
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

  function formatBytes(bytes?: number): string {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 py-4">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#27221d] tracking-tight">Family Memory</h1>
          <p className="text-xs text-[#6e655f] mt-0.5">
            Explicit, searchable preferences, decisions, documents, and household notes
          </p>
        </div>
        <button
          onClick={() => {
            setShowAddForm(!showAddForm);
            setUploadError(null);
          }}
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

      {/* Add Memory Form with File Dropzone */}
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
                placeholder="e.g. 'Dad doesn't like spicy food', 'WiFi password is ...', 'Passport copies attached', 'House insurance doc'"
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

            {/* File Upload Dropzone */}
            <div className="space-y-2 pt-1">
              <label className="block font-semibold text-[#27221d]">
                File Attachments <span className="font-normal text-[#6e655f]">(JPG, JPEG, PNG, PDF up to 6MB)</span>
              </label>

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  handleFileSelect(e.dataTransfer.files);
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition flex flex-col items-center justify-center gap-1.5 ${
                  isDragging
                    ? "border-[#c2593f] bg-[#faf3ee]"
                    : "border-[#ede7df] hover:border-[#c2593f]/60 hover:bg-[#fbf9f6]"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
                  className="hidden"
                  onChange={(e) => handleFileSelect(e.target.files)}
                />
                <span className="text-xl">📎</span>
                <p className="text-xs font-medium text-[#27221d]">
                  Click to upload or drag &amp; drop
                </p>
                <p className="text-[11px] text-[#6e655f]">
                  Photos, warranty receipts, medical records, or PDF documents
                </p>
              </div>

              {uploadError && (
                <p className="text-xs text-red-600 bg-red-50 p-2 rounded-xl border border-red-200">
                  {uploadError}
                </p>
              )}

              {/* Uploaded File Chips Preview */}
              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {attachments.map((file, idx) => {
                    const isImg = file.fileType.startsWith("image/");
                    return (
                      <div
                        key={idx}
                        className="flex items-center gap-2 p-2 bg-[#faf3ee] border border-[#f0e3d8] rounded-xl text-xs"
                      >
                        {isImg ? (
                          <img
                            src={file.url}
                            alt={file.fileName}
                            className="w-8 h-8 rounded-lg object-cover border border-[#ede7df]"
                          />
                        ) : (
                          <span className="w-8 h-8 rounded-lg bg-red-100 text-red-700 flex items-center justify-center font-bold text-xs">
                            PDF
                          </span>
                        )}
                        <div className="max-w-[140px] truncate">
                          <p className="font-semibold text-[#27221d] truncate">{file.fileName}</p>
                          <p className="text-[10px] text-[#6e655f]">{formatBytes(file.fileSize)}</p>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeAttachment(idx);
                          }}
                          className="text-[#6e655f] hover:text-red-600 p-1 text-sm font-bold"
                          title="Remove file"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setShowAddForm(false);
                setAttachments([]);
                setUploadError(null);
              }}
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

      {/* Memory List */}
      {loading ? (
        <div className="py-12 text-center text-xs text-[#6e655f]">Searching memories...</div>
      ) : memories.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-[#ede7df] space-y-2">
          <span className="text-3xl">💡</span>
          <h3 className="font-bold text-sm text-[#27221d]">No memories found</h3>
          <p className="text-xs text-[#6e655f] max-w-sm mx-auto">
            Save family preferences, notes, decisions, or document attachments here so Kutumb can always remember them.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {memories.map((m) => (
            <div
              key={m.id}
              className="bg-white rounded-3xl p-5 border border-[#ede7df] shadow-2xs space-y-3 relative group hover:border-[#c2593f]/40 transition flex flex-col justify-between"
            >
              <div className="space-y-2">
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
                <p className="text-sm font-medium text-[#27221d] leading-relaxed whitespace-pre-line">
                  {m.content}
                </p>

                {/* Attachments Section */}
                {m.attachments && m.attachments.length > 0 && (
                  <div className="pt-2 border-t border-[#ede7df]/80 space-y-2">
                    <p className="text-[11px] font-semibold text-[#6e655f] uppercase tracking-wider flex items-center gap-1">
                      <span>📎 Attachments ({m.attachments.length})</span>
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {m.attachments.map((att, aIdx) => {
                        const isImg = att.fileType.startsWith("image/");
                        if (isImg) {
                          return (
                            <button
                              key={aIdx}
                              type="button"
                              onClick={() => setPreviewImage({ url: att.url, title: att.fileName })}
                              className="relative group/thumb block rounded-xl overflow-hidden border border-[#ede7df] hover:border-[#c2593f] transition"
                            >
                              <img
                                src={att.url}
                                alt={att.fileName}
                                className="w-16 h-16 object-cover transition group-hover/thumb:scale-105"
                              />
                              <span className="absolute inset-0 bg-black/30 opacity-0 group-hover/thumb:opacity-100 transition flex items-center justify-center text-white text-xs font-bold">
                                🔍
                              </span>
                            </button>
                          );
                        }

                        return (
                          <a
                            key={aIdx}
                            href={att.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            download={att.fileName}
                            className="flex items-center gap-2 p-2 bg-[#fcf9f5] border border-[#ede7df] hover:border-[#c2593f] rounded-xl text-xs transition"
                          >
                            <span className="w-7 h-7 rounded-lg bg-red-100 text-red-700 font-bold text-[10px] flex items-center justify-center shrink-0">
                              PDF
                            </span>
                            <div className="max-w-[120px] truncate text-left">
                              <p className="font-semibold text-[#27221d] truncate">{att.fileName}</p>
                              <p className="text-[10px] text-[#6e655f]">{formatBytes(att.fileSize)} ↗</p>
                            </div>
                          </a>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between text-[10px] text-[#6e655f] pt-2 border-t border-[#ede7df]/60">
                <span>
                  Source: {m.source === "assistant" ? "Gemma Conversation" : m.source === "voice" ? "Voice Note" : "Manual Note"}
                </span>
                <span>
                  {new Date(m.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Image Preview Lightbox Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-2xl w-full p-4 shadow-2xl border border-[#ede7df] space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-1 border-b border-[#ede7df]">
              <span className="font-semibold text-xs text-[#27221d] truncate max-w-sm">
                {previewImage.title}
              </span>
              <div className="flex items-center gap-2">
                <a
                  href={previewImage.url}
                  download={previewImage.title}
                  className="px-3 py-1 rounded-xl bg-[#faf3ee] text-[#c2593f] hover:bg-[#f3eae4] text-xs font-semibold"
                >
                  Download
                </a>
                <button
                  onClick={() => setPreviewImage(null)}
                  className="p-1 text-[#6e655f] hover:text-black font-bold text-sm"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="max-h-[75vh] flex items-center justify-center overflow-auto rounded-2xl bg-black/5 p-2">
              <img
                src={previewImage.url}
                alt={previewImage.title}
                className="max-h-[70vh] max-w-full object-contain rounded-xl"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
