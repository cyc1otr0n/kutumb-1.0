import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import type { AuthContext } from "../context";
import { getEventsForDateRange, getUpcomingEvents } from "../services/events.service";
import { getTasks, toTaskDTO } from "../services/tasks.service";
import { getFamilyUpdates } from "../services/updates.service";
import { getFamilyMemory } from "../services/memories.service";
import { getFamilyReminders } from "../services/reminders.service";
import { createPendingAction } from "../services/actions.service";
import { generateDailyDigest } from "../services/digest.service";
import {
  addDaysToKey,
  dateKeyInTz,
  formatDateTime,
  isRealDate,
  relativeDayLabel,
  resolveDateRange,
  shortLabelOfKey,
  zonedToUtc,
} from "@/lib/time";
import type { EventDoc } from "../db/types";
import { MEMORY_CATEGORIES } from "../db/types";

function getAuth(context: any): AuthContext {
  const auth = context?.requestContext?.get?.("auth") || context?.auth;
  if (!auth?.familyId) {
    throw new Error("Unauthorized tool execution: missing family context");
  }
  return auth as AuthContext;
}

function serializeEvent(e: EventDoc, tz: string) {
  return {
    id: e._id.toHexString(),
    title: e.title,
    date: dateKeyInTz(e.startsAt, tz),
    when: formatDateTime(e.startsAt, tz, { allDay: e.allDay }),
    dayLabel: relativeDayLabel(e.startsAt, tz),
    location: e.location,
    description: e.description,
  };
}

/** When a requested window is empty, return the next few events so the agent can still answer helpfully. */
async function nextEventsFallback(auth: AuthContext, limit = 3) {
  const next = await getUpcomingEvents(auth.familyId, limit, new Date());
  return next.map((e) => serializeEvent(e, auth.timezone));
}

/** Resolves a day from an explicit YYYY-MM-DD, a relative phrase ("tomorrow"), or defaults to today. */
function resolveDayKey(auth: AuthContext, date?: string, relativeDay?: string): string {
  const today = dateKeyInTz(new Date(), auth.timezone);
  if (date && isRealDate(date)) return date;
  const phrase = (relativeDay || date || "").trim();
  if (phrase) {
    const resolved = resolveDateRange(phrase, auth.timezone);
    if (resolved) return resolved.startKey;
  }
  return today;
}

export const getTodayScheduleTool = createTool({
  id: "getTodaySchedule",
  description:
    "Get the family's events for ONE day. Defaults to today. Use relativeDay='tomorrow' (or 'friday', 'day after tomorrow') or date='YYYY-MM-DD' for other days.",
  inputSchema: z.object({
    date: z.string().optional().describe("Specific day in YYYY-MM-DD (family timezone)"),
    relativeDay: z
      .string()
      .optional()
      .describe("Relative day phrase such as 'today', 'tomorrow', 'day after tomorrow', 'this friday'"),
  }),
  execute: async ({ date, relativeDay }, context) => {
    const auth = getAuth(context);
    const dayKey = resolveDayKey(auth, date, relativeDay);
    const events = await getEventsForDateRange(auth.familyId, auth.timezone, dayKey, 1);
    return {
      date: dayKey,
      dayLabel: shortLabelOfKey(dayKey),
      count: events.length,
      events: events.map((e) => serializeEvent(e, auth.timezone)),
      nextUpcomingIfEmpty: events.length === 0 ? await nextEventsFallback(auth) : [],
    };
  },
});

export const getUpcomingEventsTool = createTool({
  id: "getUpcomingEvents",
  description:
    "Get upcoming events. Optionally restrict to a window with `when` (e.g. 'tomorrow', 'this weekend', 'next week', 'this friday') or startDate/endDate (YYYY-MM-DD).",
  inputSchema: z.object({
    limit: z.number().optional().default(10),
    when: z.string().optional().describe("Natural-language window like 'tomorrow', 'next week', 'this weekend'"),
    startDate: z.string().optional().describe("Window start YYYY-MM-DD (inclusive)"),
    endDate: z.string().optional().describe("Window end YYYY-MM-DD (inclusive)"),
  }),
  execute: async ({ limit, when, startDate, endDate }, context) => {
    const auth = getAuth(context);
    const tz = auth.timezone;

    let window: { startKey: string; days: number; label: string } | null = null;
    if (startDate && isRealDate(startDate)) {
      const end = endDate && isRealDate(endDate) && endDate >= startDate ? endDate : startDate;
      let days = 1;
      while (addDaysToKey(startDate, days - 1) < end && days < 62) days++;
      window = { startKey: startDate, days, label: `${shortLabelOfKey(startDate)} – ${shortLabelOfKey(end)}` };
    } else if (when) {
      window = resolveDateRange(when, tz);
    }

    const events = window
      ? await getEventsForDateRange(auth.familyId, tz, window.startKey, window.days)
      : await getUpcomingEvents(auth.familyId, limit);

    return {
      window: window ? { start: window.startKey, days: window.days, label: window.label } : null,
      count: events.length,
      events: events.slice(0, limit ?? 10).map((e) => serializeEvent(e, tz)),
      nextUpcomingIfEmpty: window && events.length === 0 ? await nextEventsFallback(auth) : [],
    };
  },
});

export const getRemindersTool = createTool({
  id: "getReminders",
  description: "List scheduled (not yet delivered) family reminders.",
  inputSchema: z.object({}),
  execute: async (_, context) => {
    const auth = getAuth(context);
    const reminders = await getFamilyReminders(auth.familyId, "scheduled");
    return {
      count: reminders.length,
      reminders: reminders.slice(0, 20).map((r) => ({
        id: r._id.toHexString(),
        message: r.message,
        when: formatDateTime(r.fireAt, auth.timezone),
      })),
    };
  },
});

export const getTasksTool = createTool({
  id: "getTasks",
  description: "Get family tasks (open by default). Optionally filter by keyword or assignee name.",
  inputSchema: z.object({
    status: z.enum(["open", "done", "all"]).optional().default("open"),
    query: z.string().optional().describe("Keyword to match in the task title/notes, e.g. 'groceries'"),
    assigneeName: z.string().optional().describe("Only tasks assigned to this family member"),
  }),
  execute: async ({ status, query, assigneeName }, context) => {
    const auth = getAuth(context);
    const docs = await getTasks(auth.familyId, status);
    let tasks = await Promise.all(docs.slice(0, 50).map((t) => toTaskDTO(t, auth.timezone)));
    if (query?.trim()) {
      const q = query.trim().toLowerCase();
      tasks = tasks.filter((t) => `${t.title} ${t.notes ?? ""}`.toLowerCase().includes(q));
    }
    if (assigneeName?.trim()) {
      const a = assigneeName.trim().toLowerCase();
      tasks = tasks.filter((t) => t.assigneeName?.toLowerCase().includes(a));
    }
    return {
      count: tasks.length,
      tasks: tasks.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        assignee: t.assigneeName,
        due: t.dueAt ? formatDateTime(t.dueAt, auth.timezone) : null,
      })),
    };
  },
});

export const getFamilyUpdatesTool = createTool({
  id: "getFamilyUpdates",
  description: "Get recent announcements and updates posted by family members.",
  inputSchema: z.object({
    limit: z.number().optional().default(10),
  }),
  execute: async ({ limit }, context) => {
    const auth = getAuth(context);
    const updates = await getFamilyUpdates(auth.familyId, limit);
    return {
      count: updates.length,
      updates: updates.map((u) => ({
        id: u._id.toHexString(),
        author: u.authorName,
        content: u.content,
        time: formatDateTime(u.createdAt, auth.timezone),
      })),
    };
  },
});

export const getFamilyMemoryTool = createTool({
  id: "getFamilyMemory",
  description: "Search stored family memory facts (birthdays, preferences, decisions, notes).",
  inputSchema: z.object({
    query: z.string().optional().describe("Search term or person name"),
    category: z.string().optional().describe("Optional category like person, preference, decision"),
  }),
  execute: async ({ query, category }, context) => {
    const auth = getAuth(context);
    const memories = await getFamilyMemory(auth.familyId, { query, category });
    return {
      count: memories.length,
      memories: memories.map((m) => ({
        id: m._id.toHexString(),
        content: m.content,
        category: m.category,
      })),
    };
  },
});

export const getDailyDigestTool = createTool({
  id: "getDailyDigest",
  description: "Retrieve or generate the concise daily family digest.",
  inputSchema: z.object({}),
  execute: async (_, context) => {
    const auth = getAuth(context);
    const digest = await generateDailyDigest(auth);
    return {
      headline: digest.headline,
      sections: digest.sections,
      spokenText: digest.spokenText,
    };
  },
});

export const createFamilyEventTool = createTool({
  id: "createFamilyEvent",
  description: "Propose creating a family event or appointment on a specific date and time.",
  inputSchema: z.object({
    title: z.string().describe("Title of the event, e.g. 'Electrician visit' or 'Family dinner'"),
    date: z.string().describe("Date in YYYY-MM-DD format (in family timezone)"),
    time: z.string().optional().describe("Time in HH:MM format (24h) e.g. '11:00' or '19:00'"),
    allDay: z.boolean().optional().default(false),
    location: z.string().optional(),
    description: z.string().optional(),
  }),
  execute: async ({ title, date, time, allDay, location, description }, context) => {
    const auth = getAuth(context);
    const eventTime = time || "09:00";
    const startsAt = zonedToUtc(date, eventTime, auth.timezone);

    const pending = await createPendingAction(auth, {
      kind: "create_event",
      payload: {
        title,
        startsAt: startsAt.toISOString(),
        allDay: !!allDay,
        location,
        description,
      },
      preview: {
        kind: "create_event",
        title: `Add Event: ${title}`,
        details: [
          { label: "Date & Time", value: formatDateTime(startsAt, auth.timezone, { allDay }) },
          ...(location ? [{ label: "Location", value: location }] : []),
        ],
        warnings: [],
        destructive: false,
      },
      source: "ask",
    });

    return {
      actionId: pending._id.toHexString(),
      status: "pending_confirmation",
      message: `I've prepared the event "${title}" for ${formatDateTime(startsAt, auth.timezone, { allDay })}. Please confirm to add it.`,
    };
  },
});

export const createTaskTool = createTool({
  id: "createTask",
  description: "Propose creating a task or to-do for the family.",
  inputSchema: z.object({
    title: z.string().describe("Task description, e.g. 'Clear the balcony' or 'Pick up the cake'"),
    assigneeName: z.string().optional().describe("Name of the family member responsible, if mentioned"),
    dueDate: z.string().optional().describe("Due date in YYYY-MM-DD format"),
    notes: z.string().optional(),
  }),
  execute: async ({ title, assigneeName, dueDate, notes }, context) => {
    const auth = getAuth(context);
    const dueAt = dueDate ? zonedToUtc(dueDate, "18:00", auth.timezone) : null;

    const pending = await createPendingAction(auth, {
      kind: "create_task",
      payload: {
        title,
        assigneeName,
        dueAt: dueAt ? dueAt.toISOString() : null,
        notes,
      },
      preview: {
        kind: "create_task",
        title: `Create Task: ${title}`,
        details: [
          ...(assigneeName ? [{ label: "Assigned To", value: assigneeName }] : []),
          ...(dueAt ? [{ label: "Due", value: formatDateTime(dueAt, auth.timezone) }] : []),
        ],
        warnings: [],
        destructive: false,
      },
      source: "ask",
    });

    return {
      actionId: pending._id.toHexString(),
      status: "pending_confirmation",
      message: `I've prepared the task "${title}"${assigneeName ? ` for ${assigneeName}` : ""}. Please confirm to save it.`,
    };
  },
});

export const assignTaskTool = createTool({
  id: "assignTask",
  description: "Assign an existing task to a family member.",
  inputSchema: z.object({
    taskId: z.string(),
    memberName: z.string().describe("Name of the family member, e.g. 'Dad'"),
  }),
  execute: async ({ taskId, memberName }, context) => {
    const auth = getAuth(context);
    const pending = await createPendingAction(auth, {
      kind: "assign_task",
      payload: { taskId, memberName },
      preview: {
        kind: "assign_task",
        title: `Assign Task to ${memberName}`,
        details: [{ label: "Member", value: memberName }],
        warnings: [],
        destructive: false,
      },
      source: "ask",
    });

    return {
      actionId: pending._id.toHexString(),
      status: "pending_confirmation",
      message: `I've prepared to assign this task to ${memberName}. Please confirm.`,
    };
  },
});

export const completeTaskTool = createTool({
  id: "completeTask",
  description: "Mark a family task as completed.",
  inputSchema: z.object({
    taskId: z.string(),
  }),
  execute: async ({ taskId }, context) => {
    const auth = getAuth(context);
    const pending = await createPendingAction(auth, {
      kind: "complete_task",
      payload: { taskId },
      preview: {
        kind: "complete_task",
        title: "Complete Task",
        details: [{ label: "Task ID", value: taskId }],
        warnings: [],
        destructive: false,
      },
      source: "ask",
    });

    return {
      actionId: pending._id.toHexString(),
      status: "pending_confirmation",
      message: "Please confirm marking this task as done.",
    };
  },
});

export const createReminderTool = createTool({
  id: "createReminder",
  description: "Schedule a durable reminder via Temporal for a specific date and time.",
  inputSchema: z.object({
    message: z.string().describe("What to remind the family about"),
    date: z.string().describe("Date in YYYY-MM-DD format"),
    time: z.string().describe("Time in HH:MM 24h format, e.g. '09:00' or '18:00'"),
  }),
  execute: async ({ message, date, time }, context) => {
    const auth = getAuth(context);
    const fireAt = zonedToUtc(date, time, auth.timezone);

    const pending = await createPendingAction(auth, {
      kind: "create_reminder",
      payload: {
        message,
        fireAt: fireAt.toISOString(),
      },
      preview: {
        kind: "create_reminder",
        title: `Schedule Reminder: "${message}"`,
        details: [
          { label: "Reminder Time", value: formatDateTime(fireAt, auth.timezone) },
        ],
        warnings: [],
        destructive: false,
      },
      source: "ask",
    });

    return {
      actionId: pending._id.toHexString(),
      status: "pending_confirmation",
      message: `I've prepared the reminder "${message}" for ${formatDateTime(fireAt, auth.timezone)}. Please confirm to schedule it.`,
    };
  },
});

export const createFamilyUpdateTool = createTool({
  id: "createFamilyUpdate",
  description: "Post a message or announcement to the shared family updates board.",
  inputSchema: z.object({
    content: z.string().describe("The message or announcement to share"),
  }),
  execute: async ({ content }, context) => {
    const auth = getAuth(context);
    const pending = await createPendingAction(auth, {
      kind: "create_update",
      payload: { content },
      preview: {
        kind: "create_update",
        title: "Post Family Update",
        details: [{ label: "Message", value: content }],
        warnings: [],
        destructive: false,
      },
      source: "ask",
    });

    return {
      actionId: pending._id.toHexString(),
      status: "pending_confirmation",
      message: `I've prepared this update for the family: "${content}". Please confirm to share it.`,
    };
  },
});

export const saveFamilyMemoryTool = createTool({
  id: "saveFamilyMemory",
  description: "Save an important family preference, birthday, decision, or note to long-term memory.",
  inputSchema: z.object({
    content: z.string().describe("The fact to remember, e.g. 'Dad doesn't like spicy food'"),
    category: z.enum(MEMORY_CATEGORIES).optional().default("miscellaneous"),
  }),
  execute: async ({ content, category }, context) => {
    const auth = getAuth(context);
    const pending = await createPendingAction(auth, {
      kind: "save_memory",
      payload: { content, category },
      preview: {
        kind: "save_memory",
        title: "Save Family Memory",
        details: [
          { label: "Fact", value: content },
          { label: "Category", value: category },
        ],
        warnings: [],
        destructive: false,
      },
      source: "ask",
    });

    return {
      actionId: pending._id.toHexString(),
      status: "pending_confirmation",
      message: `I've prepared to save this memory: "${content}". Please confirm to keep it in family memory.`,
    };
  },
});

export const kutumbTools = {
  getTodaySchedule: getTodayScheduleTool,
  getUpcomingEvents: getUpcomingEventsTool,
  getReminders: getRemindersTool,
  getTasks: getTasksTool,
  getFamilyUpdates: getFamilyUpdatesTool,
  getFamilyMemory: getFamilyMemoryTool,
  getDailyDigest: getDailyDigestTool,
  createFamilyEvent: createFamilyEventTool,
  createTask: createTaskTool,
  assignTask: assignTaskTool,
  completeTask: completeTaskTool,
  createReminder: createReminderTool,
  createFamilyUpdate: createFamilyUpdateTool,
  saveFamilyMemory: saveFamilyMemoryTool,
};
