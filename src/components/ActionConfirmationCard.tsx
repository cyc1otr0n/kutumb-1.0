"use client";

import { useState } from "react";
import type { PendingActionDTO } from "@/lib/types";

export function ActionConfirmationCard({
  action,
  onResolved,
}: {
  action: PendingActionDTO;
  onResolved?: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(action.status);
  const [resultMsg, setResultMsg] = useState(action.result?.message || null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleConfirm() {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/actions/${action.id}/confirm`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Confirmation failed");
      }
      setStatus("confirmed");
      setResultMsg(data.message);
      onResolved?.();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to confirm action");
    } finally {
      setLoading(false);
    }
  }

  async function handleDismiss() {
    setLoading(true);
    setErrorMsg(null);
    try {
      await fetch(`/api/actions/${action.id}/dismiss`, { method: "POST" });
      setStatus("dismissed");
      onResolved?.();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to dismiss action");
    } finally {
      setLoading(false);
    }
  }

  if (status === "dismissed") {
    return (
      <div className="p-3 bg-[#f6f2ec] rounded-xl text-xs text-[#6e655f] italic border border-[#ede7df]">
        Action discarded.
      </div>
    );
  }

  if (status === "confirmed") {
    return (
      <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-[10px]">
            ✓
          </span>
          <span className="font-medium">{resultMsg || "Action confirmed and saved to family data."}</span>
        </div>
        <span className="text-[10px] text-emerald-700 uppercase tracking-wider font-semibold">Done</span>
      </div>
    );
  }

  return (
    <div className="bg-white border border-[#f0e3d8] rounded-2xl p-4 shadow-sm space-y-3 my-2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-lg bg-[#faf3ee] text-[#c2593f] flex items-center justify-center text-xs font-bold">
            ✦
          </span>
          <h4 className="font-semibold text-sm text-[#27221d]">{action.preview.title}</h4>
        </div>
        <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-[#faf3ee] text-[#c2593f] border border-[#f0e3d8]">
          Review Proposal
        </span>
      </div>

      {action.preview.details.length > 0 && (
        <div className="bg-[#faf8f5] rounded-xl p-3 space-y-1.5 border border-[#ede7df]/60 text-xs">
          {action.preview.details.map((d, i) => (
            <div key={i} className="flex items-center justify-between">
              <span className="text-[#6e655f] font-medium">{d.label}:</span>
              <span className="text-[#27221d] font-semibold text-right">{d.value}</span>
            </div>
          ))}
        </div>
      )}

      {errorMsg && (
        <div className="text-xs text-red-600 bg-red-50 p-2 rounded-lg border border-red-200">
          {errorMsg}
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          onClick={handleDismiss}
          disabled={loading}
          className="px-3 py-1.5 rounded-xl text-xs font-medium text-[#6e655f] hover:bg-[#f6f2ec] transition disabled:opacity-50"
        >
          Dismiss
        </button>
        <button
          onClick={handleConfirm}
          disabled={loading}
          className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-[#c2593f] text-white hover:bg-[#aa4a32] shadow-sm transition disabled:opacity-50 flex items-center gap-1.5"
        >
          {loading ? (
            <>
              <span className="animate-spin text-xs">⟳</span>
              <span>Confirming...</span>
            </>
          ) : (
            <span>Confirm &amp; Save</span>
          )}
        </button>
      </div>
    </div>
  );
}
