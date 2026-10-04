"use client";

import { useEffect, useState } from "react";
import type { TaskDTO, MemberDTO } from "@/lib/types";

export default function TasksPage() {
  const [tasks, setTasks] = useState<TaskDTO[]>([]);
  const [members, setMembers] = useState<MemberDTO[]>([]);
  const [filter, setFilter] = useState<"all" | "open" | "done">("open");
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [title, setTitle] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadTasks();
    loadMembers();
  }, [filter]);

  async function loadTasks() {
    setLoading(true);
    try {
      const res = await fetch(`/api/tasks?status=${filter}`);
      if (res.ok) {
        const data = await res.json();
        setTasks(data);
      }
    } catch (err) {
      console.error("Tasks fetch error:", err);
    } finally {
      setLoading(false);
    }
  }

  async function loadMembers() {
    try {
      const res = await fetch("/api/family/members");
      if (res.ok) {
        const data = await res.json();
        setMembers(data);
      }
    } catch (err) {
      console.error("Members fetch error:", err);
    }
  }

  async function handleToggleStatus(task: TaskDTO) {
    const action = task.status === "open" ? "complete" : "reopen";
    try {
      await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      loadTasks();
    } catch (err) {
      console.error("Task toggle error:", err);
    }
  }

  async function handleAddTask(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    setSaving(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          assigneeMemberId: assigneeId || undefined,
          dueAt: dueDate ? new Date(`${dueDate}T18:00:00Z`).toISOString() : undefined,
          notes,
        }),
      });

      if (res.ok) {
        setTitle("");
        setAssigneeId("");
        setDueDate("");
        setNotes("");
        setShowAddForm(false);
        loadTasks();
      }
    } catch (err) {
      console.error("Add task error:", err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#27221d] tracking-tight">Family Tasks</h1>
          <p className="text-xs text-[#6e655f] mt-0.5">Shared responsibilities and to-dos for everyone in the family</p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-4 py-2 rounded-xl bg-[#c2593f] text-white font-semibold text-xs hover:bg-[#aa4a32] shadow-xs transition flex items-center gap-1.5"
        >
          <span>{showAddForm ? "Cancel" : "+ Add Task"}</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-[#ede7df] pb-3 text-xs">
        <button
          onClick={() => setFilter("open")}
          className={`px-3 py-1.5 rounded-xl font-semibold transition ${
            filter === "open" ? "bg-[#faf3ee] text-[#c2593f]" : "text-[#6e655f] hover:text-[#27221d]"
          }`}
        >
          Open Tasks
        </button>
        <button
          onClick={() => setFilter("done")}
          className={`px-3 py-1.5 rounded-xl font-semibold transition ${
            filter === "done" ? "bg-[#faf3ee] text-[#c2593f]" : "text-[#6e655f] hover:text-[#27221d]"
          }`}
        >
          Completed
        </button>
        <button
          onClick={() => setFilter("all")}
          className={`px-3 py-1.5 rounded-xl font-semibold transition ${
            filter === "all" ? "bg-[#faf3ee] text-[#c2593f]" : "text-[#6e655f] hover:text-[#27221d]"
          }`}
        >
          All
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleAddTask} className="bg-white rounded-3xl p-6 border border-[#ede7df] shadow-xs space-y-4 animate-in fade-in">
          <h3 className="font-bold text-sm text-[#27221d]">New Task</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="md:col-span-2">
              <label className="block font-semibold text-[#27221d] mb-1">Task Title *</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Clear the balcony, Buy groceries, Pick up cake"
                className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-[#ede7df] focus:border-[#c2593f] outline-hidden"
              />
            </div>
            <div>
              <label className="block font-semibold text-[#27221d] mb-1">Assign to Member</label>
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-[#ede7df] focus:border-[#c2593f] outline-hidden bg-white"
              >
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.relation || "Member"})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-[#27221d] mb-1">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-[#ede7df] focus:border-[#c2593f] outline-hidden"
              />
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
              {saving ? "Saving..." : "Create Task"}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="py-12 text-center text-xs text-[#6e655f]">Loading tasks...</div>
      ) : tasks.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-[#ede7df] space-y-2">
          <span className="text-3xl">✓</span>
          <h3 className="font-bold text-sm text-[#27221d]">No tasks found</h3>
          <p className="text-xs text-[#6e655f] max-w-sm mx-auto">
            Add tasks using the button above or tell Kutumb: &ldquo;Create a task to pick up the cake.&rdquo;
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {tasks.map((task) => (
            <div
              key={task.id}
              className={`p-4 rounded-2xl border transition flex items-center justify-between gap-3 ${
                task.status === "done"
                  ? "bg-[#faf8f5]/60 border-[#ede7df]/60 opacity-60"
                  : "bg-white border-[#ede7df] shadow-2xs hover:border-[#c2593f]/40"
              }`}
            >
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleToggleStatus(task)}
                  className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition ${
                    task.status === "done"
                      ? "bg-emerald-600 border-emerald-600 text-white font-bold text-xs"
                      : "border-[#6e655f] hover:border-[#c2593f]"
                  }`}
                >
                  {task.status === "done" && "✓"}
                </button>
                <div>
                  <h4
                    className={`font-semibold text-sm ${
                      task.status === "done" ? "line-through text-[#6e655f]" : "text-[#27221d]"
                    }`}
                  >
                    {task.title}
                  </h4>
                  {task.notes && <p className="text-xs text-[#6e655f] mt-0.5">{task.notes}</p>}
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs shrink-0">
                {task.assigneeName && (
                  <span className="px-2.5 py-1 rounded-full bg-[#faf3ee] text-[#c2593f] font-medium border border-[#f0e3d8]">
                    👤 {task.assigneeName}
                  </span>
                )}
                {task.dueLabel && (
                  <span className="font-semibold text-[#6e655f]">
                    Due {task.dueLabel}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
