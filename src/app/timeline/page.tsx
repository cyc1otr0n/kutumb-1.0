"use client";

import { useEffect, useState } from "react";
import type { ActivityDTO } from "@/lib/types";

export default function TimelinePage() {
  const [activities, setActivities] = useState<ActivityDTO[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTimeline();
  }, []);

  async function loadTimeline() {
    setLoading(true);
    try {
      const res = await fetch("/api/timeline");
      if (res.ok) {
        const data = await res.json();
        setActivities(data);
      }
    } catch (err) {
      console.error("Timeline fetch error:", err);
    } finally {
      setLoading(false);
    }
  }

  const getIconForType = (type: string) => {
    switch (type) {
      case "event_created":
      case "event_updated":
      case "event_deleted":
        return "📅";
      case "task_created":
      case "task_assigned":
      case "task_completed":
        return "✓";
      case "update_posted":
        return "💬";
      case "memory_saved":
        return "💡";
      case "reminder_scheduled":
      case "reminder_delivered":
        return "🔔";
      case "voice_update":
        return "🎙️";
      case "member_added":
        return "👋";
      default:
        return "✦";
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 py-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-[#27221d] tracking-tight">Family Timeline</h1>
        <p className="text-xs text-[#6e655f]">
          A calm, chronological view of what happened across plans, tasks, updates, and memories
        </p>
      </div>

      {loading ? (
        <div className="py-12 text-center text-xs text-[#6e655f]">Loading timeline...</div>
      ) : activities.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-[#ede7df] space-y-2">
          <span className="text-3xl">🕰️</span>
          <h3 className="font-bold text-sm text-[#27221d]">No activity recorded yet</h3>
          <p className="text-xs text-[#6e655f] max-w-sm mx-auto">
            As your family coordinates events, adds tasks, and shares updates, they will appear here in chronological order.
          </p>
        </div>
      ) : (
        <div className="relative pl-6 space-y-4 before:content-[''] before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-[#ede7df]">
          {activities.map((a) => (
            <div key={a.id} className="relative flex items-start gap-4">
              {/* Dot Icon */}
              <div className="w-6 h-6 rounded-full bg-white border-2 border-[#c2593f] flex items-center justify-center text-[10px] shrink-0 z-10 shadow-2xs">
                {getIconForType(a.type)}
              </div>

              {/* Activity Card */}
              <div className="bg-white rounded-2xl p-4 border border-[#ede7df] shadow-2xs flex-1 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[#27221d]">{a.actorName}</span>
                  <span className="text-[11px] text-[#6e655f]">
                    {new Date(a.createdAt).toLocaleDateString([], {
                      month: "short",
                      day: "numeric",
                    })}{" "}
                    ·{" "}
                    {new Date(a.createdAt).toLocaleTimeString([], {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <p className="text-xs text-[#27221d] leading-relaxed">{a.summary}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
