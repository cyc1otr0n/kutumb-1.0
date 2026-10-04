"use client";

import { useEffect, useState } from "react";
import type { EventDTO } from "@/lib/types";

export default function EventsPage() {
  const [events, setEvents] = useState<EventDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("11:00");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [allDay, setAllDay] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadEvents();
  }, []);

  async function loadEvents() {
    setLoading(true);
    try {
      const res = await fetch("/api/events");
      if (res.ok) {
        const data = await res.json();
        setEvents(data);
      }
    } catch (err) {
      console.error("Events fetch error:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !date) return;

    setSaving(true);
    try {
      const startsAt = allDay ? new Date(`${date}T00:00:00Z`).toISOString() : new Date(`${date}T${time || "09:00"}:00`).toISOString();
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          startsAt,
          allDay,
          location,
          description,
        }),
      });

      if (res.ok) {
        setTitle("");
        setLocation("");
        setDescription("");
        setShowAddForm(false);
        loadEvents();
      }
    } catch (err) {
      console.error("Add event error:", err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteEvent(id: string) {
    if (!confirm("Are you sure you want to remove this family event?")) return;
    try {
      await fetch(`/api/events/${id}`, { method: "DELETE" });
      loadEvents();
    } catch (err) {
      console.error("Delete event error:", err);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#27221d] tracking-tight">Family Events &amp; Plans</h1>
          <p className="text-xs text-[#6e655f] mt-0.5">Appointments, trips, birthdays, and family visits</p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-4 py-2 rounded-xl bg-[#c2593f] text-white font-semibold text-xs hover:bg-[#aa4a32] shadow-xs transition flex items-center gap-1.5"
        >
          <span>{showAddForm ? "Cancel" : "+ Add Event"}</span>
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleAddEvent} className="bg-white rounded-3xl p-6 border border-[#ede7df] shadow-xs space-y-4 animate-in fade-in">
          <h3 className="font-bold text-sm text-[#27221d]">New Family Event</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-[#27221d] mb-1">Event Title *</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Electrician visit, Family Dinner"
                className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-[#ede7df] focus:border-[#c2593f] outline-hidden"
              />
            </div>
            <div>
              <label className="block font-semibold text-[#27221d] mb-1">Location (Optional)</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Home, Grand Hotel"
                className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-[#ede7df] focus:border-[#c2593f] outline-hidden"
              />
            </div>
            <div>
              <label className="block font-semibold text-[#27221d] mb-1">Date *</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-[#ede7df] focus:border-[#c2593f] outline-hidden"
              />
            </div>
            <div>
              <label className="block font-semibold text-[#27221d] mb-1">Time</label>
              <input
                type="time"
                disabled={allDay}
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-[#ede7df] focus:border-[#c2593f] outline-hidden disabled:opacity-40"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              id="allDay"
              checked={allDay}
              onChange={(e) => setAllDay(e.target.checked)}
              className="rounded-sm text-[#c2593f]"
            />
            <label htmlFor="allDay" className="text-[#27221d] font-medium">All day event</label>
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
              {saving ? "Saving..." : "Save Event"}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="py-12 text-center text-xs text-[#6e655f]">Loading events...</div>
      ) : events.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-[#ede7df] space-y-2">
          <span className="text-3xl">📅</span>
          <h3 className="font-bold text-sm text-[#27221d]">No family events scheduled yet</h3>
          <p className="text-xs text-[#6e655f] max-w-sm mx-auto">
            You can add events using the button above, or ask Kutumb: &ldquo;Add dinner with the family on Sunday at 7.&rdquo;
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {events.map((e) => (
            <div
              key={e.id}
              className="bg-white rounded-3xl p-5 border border-[#ede7df] shadow-2xs space-y-2 relative group hover:border-[#c2593f]/40 transition"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#c2593f]">
                    {e.dayLabel}
                  </span>
                  <h3 className="font-bold text-base text-[#27221d] mt-0.5">{e.title}</h3>
                </div>
                <button
                  onClick={() => handleDeleteEvent(e.id)}
                  title="Remove event"
                  className="text-xs text-[#6e655f] hover:text-red-600 opacity-60 group-hover:opacity-100 transition p-1"
                >
                  ✕
                </button>
              </div>

              <div className="text-xs text-[#6e655f] space-y-1">
                <p>⏰ {e.timeLabel || "All day"}</p>
                {e.location && <p>📍 {e.location}</p>}
                {e.description && <p className="italic text-[#27221d] mt-1">{e.description}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
