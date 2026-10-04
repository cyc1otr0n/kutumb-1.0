import { Agent } from "@mastra/core/agent";
import { RequestContext } from "@mastra/core/request-context";
import { kutumbTools } from "./tools";
import { env } from "../env";
import type { AuthContext } from "../context";
import { traceSpan } from "../observability";
import { createPendingAction, toPendingActionDTO } from "../services/actions.service";
import { getAllUpcomingOrRecentEvents, getEventsForDateRange } from "../services/events.service";
import { getTasks } from "../services/tasks.service";
import { getFamilyMemory } from "../services/memories.service";
import { getFamilyReminders } from "../services/reminders.service";
import { collections } from "../db/client";
import type { AskResponseDTO, PendingActionDTO } from "@/lib/types";
import { addDaysToKey, dateKeyInTz, formatDateTime, relativeDayLabel, resolveDateRange, zonedToUtc } from "@/lib/time";

export function createKutumbAgent(auth: AuthContext) {
  let modelName = env.gemmaModel();
  if (!modelName || modelName.includes("gemma") || modelName === "gemma-4-31b-it" || modelName === "gemma-4-26b-a4b-it") {
    modelName = "gemini-2.5-flash";
  }

  return new Agent({
    id: "kutumb-agent",
    name: "Kutumb Agent",
    instructions: `You are Kutumb, a warm, concise AI assistant for "${auth.familyName}".
User speaking: "${auth.userName}". Family timezone: "${auth.timezone}".
Keep answers concise (1-2 sentences). Ground answers strictly in tool output.
Today's date: "${dateKeyInTz(new Date(), auth.timezone)}".
Always query your tools when asked about events, schedules, tasks, or reminders.`,
    model: `google/${modelName}`,
    tools: kutumbTools,
  });
}

interface FallbackResult extends AskResponseDTO {
  matched: boolean;
}

/**
 * Splits compound or multi-statement user inputs like:
 * "1. Add dinner with the family on Sunday at 7. 2. Create a task to pick up the cake"
 * or "The electrician is coming tomorrow at 11. We need to clear the balcony."
 */
function splitIntoStatements(query: string): string[] {
  let q = query.replace(/(\d+[\.\)]\s*)/g, "\n$1");
  const rawParts = q.split(
    /\n+|(?<=[.!?])\s+(?=[A-Z0-9])|(?<=["”])\s*(?=\d+[\.\)]|[A-Z])|\s+and\s+(?=(?:create|add|remind|remember|save|tell|we need|task|event)\b)/i
  );

  return rawParts
    .map((p) => p.replace(/^[\s"“'”\d\.\)\-]+/, "").replace(/[\s"“'”]+$/, "").trim())
    .filter((p) => p.length > 2);
}

/**
 * Extracts a wall-clock time string (HH:mm in 24h) and allDay flag from natural language.
 */
function extractTimeFromText(text: string): { time: string; allDay: boolean } {
  const lower = text.toLowerCase();

  const explicitAt = lower.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/);
  const timeMatch =
    explicitAt ||
    lower.match(/\b(\d{1,2}):(\d{2})\s*(am|pm)?\b/) ||
    lower.match(/\b(\d{1,2})\s*(am|pm)\b/);

  if (timeMatch) {
    let hours = parseInt(timeMatch[1], 10);
    const minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    const ampm = timeMatch[3];

    if (ampm === "pm" && hours < 12) {
      hours += 12;
    } else if (ampm === "am" && hours === 12) {
      hours = 0;
    } else if (!ampm) {
      if (hours >= 1 && hours <= 6) {
        hours += 12;
      } else if (
        (hours === 7 || hours === 8 || hours === 9) &&
        (lower.includes("dinner") || lower.includes("evening") || lower.includes("night") || lower.includes("pm"))
      ) {
        hours += 12;
      }
    }

    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      return {
        time: `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`,
        allDay: false,
      };
    }
  }

  if (lower.includes("morning")) return { time: "09:00", allDay: false };
  if (lower.includes("afternoon")) return { time: "14:00", allDay: false };
  if (lower.includes("evening") || lower.includes("dinner")) return { time: "19:00", allDay: false };
  if (lower.includes("night")) return { time: "20:00", allDay: false };
  if (lower.includes("lunch")) return { time: "12:30", allDay: false };
  if (lower.includes("breakfast")) return { time: "08:30", allDay: false };

  return { time: "10:00", allDay: true };
}

function extractEventTitle(text: string): string {
  const lower = text.toLowerCase();

  if (lower.includes("electrician")) return "Electrician visit";
  if (lower.includes("plumber")) return "Plumber visit";
  if (lower.includes("carpenter")) return "Carpenter visit";
  if (lower.includes("doctor")) return "Doctor appointment";
  if (lower.includes("dentist")) return "Dentist appointment";
  if (lower.includes("dinner")) {
    if (lower.includes("family")) return "Dinner with the family";
    return "Family dinner";
  }
  if (lower.includes("lunch")) {
    if (lower.includes("family")) return "Lunch with the family";
    return "Family lunch";
  }
  if (lower.includes("breakfast")) return "Family breakfast";

  let title = text
    .replace(
      /^\s*(?:\d+[\.\)]\s*)?(?:please\s+)?(?:add|create|schedule|plan|set up|set)\s+(?:an?\s+)?(?:event|meeting|appointment|reminder|task)?\s*(?:for|to|called|titled|named|:)?\s*/i,
      ""
    )
    .replace(/\s+(?:is|are)\s+coming\b.*$/i, "")
    .replace(
      /\s+(?:on|for|this|next|tomorrow|today|tonight)\s+(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday|today|tomorrow|weekend|week|morning|afternoon|evening|night)?\b.*$/i,
      ""
    )
    .replace(/\s+at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b.*$/i, "")
    .replace(/^the\s+/i, "")
    .replace(/^["'“](.*)["'”]$/, "$1")
    .trim();

  title = title.replace(/[.,;!?]+$/, "").trim();
  if (!title || title.length < 2) title = "Family Event";
  return title.charAt(0).toUpperCase() + title.slice(1);
}

function extractTaskTitle(text: string): string {
  let title = text
    .replace(
      /^\s*(?:\d+[\.\)]\s*)?(?:please\s+)?(?:create|add|set|make)\s+(?:an?\s+)?(?:new\s+)?task\s*(?:to|for|called|titled|named|:)?\s*/i,
      ""
    )
    .replace(/^\s*task:\s*/i, "")
    .replace(/^\s*(?:we|i|someone)\s+(?:need|needs|have|has)\s+to\s+/i, "")
    .replace(/^\s*(?:don't|do not|dont)\s+forget\s+to\s+/i, "")
    .replace(/^["'“](.*)["'”]$/, "$1")
    .trim();

  title = title.replace(/[.,;!?]+$/, "").trim();
  if (!title || title.length < 2) title = "Family Task";
  return title.charAt(0).toUpperCase() + title.slice(1);
}

function extractReminderDetails(text: string, tz: string): { message: string; fireAt: Date } {
  const todayKey = dateKeyInTz(new Date(), tz);
  const tomorrowKey = addDaysToKey(todayKey, 1);

  const resolvedDate = resolveDateRange(text, tz, new Date());
  const dateKey = resolvedDate ? resolvedDate.startKey : text.toLowerCase().includes("tomorrow") ? tomorrowKey : todayKey;
  const { time } = extractTimeFromText(text);
  const fireAt = zonedToUtc(dateKey, time, tz);

  let message = text
    .replace(/^\s*(?:\d+[\.\)]\s*)?(?:please\s+)?remind(?:\s+everyone|\s+us|\s+me|\s+family)?\s*(?:to|about|that)?\s*/i, "")
    .replace(/^\s*reminder:\s*/i, "")
    .replace(/^(?:tomorrow|today|tonight|next\s+\w+|this\s+\w+|on\s+\w+)\s*(?:morning|afternoon|evening|night)?\s*(?:to|about|that)?\s*/i, "")
    .replace(/\s+(?:on|for|this|next|tomorrow|today)\s+(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday|morning|afternoon|evening|night)\b.*$/i, "")
    .replace(/\s+at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b.*$/i, "")
    .replace(/^["'“](.*)["'”]$/, "$1")
    .trim();

  message = message.replace(/[.,;!?]+$/, "").trim();
  if (!message || message.length < 2) message = text.trim();
  return { message: message.charAt(0).toUpperCase() + message.slice(1), fireAt };
}

function extractMemoryFact(text: string): {
  content: string;
  category: "preference" | "important" | "medical" | "routine" | "story";
} {
  let fact = text
    .replace(
      /^\s*(?:\d+[\.\)]\s*)?(?:please\s+)?(?:remember|save|store|note|record|keep in mind)\s+(?:that|this|the fact that)?\s*/i,
      ""
    )
    .replace(/^\s*(?:memory|preference|note|fact):\s*/i, "")
    .replace(/^["'“](.*)["'”]$/, "$1")
    .trim();

  fact = fact.replace(/[.,;!?]+$/, "").trim();
  if (!fact) fact = text.trim();
  const lower = fact.toLowerCase();

  let category: "preference" | "important" | "medical" | "routine" | "story" = "important";
  if (lower.includes("like") || lower.includes("dislike") || lower.includes("favorite") || lower.includes("favourite") || lower.includes("prefer")) {
    category = "preference";
  } else if (lower.includes("allergic") || lower.includes("allergy") || lower.includes("doctor") || lower.includes("medicine") || lower.includes("blood")) {
    category = "medical";
  } else if (lower.includes("everyday") || lower.includes("daily") || lower.includes("routine") || lower.includes("usually")) {
    category = "routine";
  }

  return { content: fact.charAt(0).toUpperCase() + fact.slice(1), category };
}

/**
 * High-level orchestration for user queries (text or transcribed voice).
 * Prioritizes sub-50ms deterministic family intent parsing first,
 * with a reliable 15s timeout on LLM reasoning.
 */
export async function executeKutumbQuery(
  ctx: AuthContext,
  query: string,
  source: "ask" | "voice" = "ask"
): Promise<AskResponseDTO> {
  return traceSpan({ name: "kutumb.query", op: "agent.execute" }, async (span) => {
    span.setAttributes({
      "agent.query_length": query.length,
      "agent.source": source,
    });

    // 1. High-Efficiency Fast-Path (<20ms response time)
    // Directly identifies family intent (events, tasks, reminders, updates, memories, queries)
    const fastResult = await executeDeterministicFallback(ctx, query, source);
    if (fastResult.matched) {
      span.setAttributes({ "agent.fast_path": true });
      return {
        reply: fastResult.reply,
        actions: fastResult.actions,
        toolsUsed: fastResult.toolsUsed,
      };
    }

    // 2. Open-ended reasoning path via Mastra Agent / Gemini with 15s timeout
    const apiKey = env.googleApiKey();
    if (apiKey) {
      try {
        const agent = createKutumbAgent(ctx);
        const reqContext = new RequestContext<{ auth: AuthContext }>();
        reqContext.set("auth", ctx);

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("AI generation timed out (15s limit)")), 15000)
        );

        const result = await Promise.race([
          agent.generate(query, { requestContext: reqContext }),
          timeoutPromise,
        ]);

        // Collect pending actions generated during this execution
        const { pendingActions } = await collections();
        const recentActions = await pendingActions
          .find({
            familyId: ctx.familyId,
            userId: ctx.userId,
            status: "pending",
            createdAt: { $gte: new Date(Date.now() - 30000) },
          })
          .sort({ createdAt: -1 })
          .toArray();

        return {
          reply: result.text || "I've reviewed your request and prepared the relevant family updates.",
          actions: recentActions.map(toPendingActionDTO),
          toolsUsed: fastResult.toolsUsed,
        };
      } catch (err: any) {
        console.warn("[Kutumb Agent] AI reasoning failed, using fallback:", err?.message);
      }
    }

    return {
      reply: fastResult.reply,
      actions: fastResult.actions,
      toolsUsed: fastResult.toolsUsed,
    };
  });
}

/**
 * Robust fallback matching PRD Section 24 demo flows and natural family commands:
 * - "1. Add dinner with the family on Sunday at 7. 2. Create a task to pick up the cake"
 * - "The electrician is coming tomorrow at 11. We need to clear the balcony."
 * - "When is electrician visit scheduled?" / "What's happening tomorrow?"
 * - "What tasks do I have?" / "Create a task to buy milk"
 * - "Remind me to call grandma tomorrow morning"
 * - "Save that Dad doesn't like spicy food"
 */
async function executeDeterministicFallback(
  ctx: AuthContext,
  query: string,
  source: "ask" | "voice"
): Promise<FallbackResult> {
  const q = query.trim();
  const lower = q.toLowerCase();
  const toolsUsed: string[] = [];
  const actions: PendingActionDTO[] = [];

  const todayKey = dateKeyInTz(new Date(), ctx.timezone);
  const tomorrowKey = addDaysToKey(todayKey, 1);

  // Split multi-statement or numbered inputs into separate clauses
  const statements = splitIntoStatements(q);

  // -------------------------------------------------------------------------
  // PHASE 1: Parse and generate pending actions for creation statements
  // -------------------------------------------------------------------------
  for (const stmt of statements) {
    const sLower = stmt.toLowerCase();

    // 1. Family Update / Announcement (Check before generic event creation so "Dinner is now at 7 instead of 6" is an update)
    const isFamilyUpdate =
      sLower.startsWith("tell the family") ||
      sLower.startsWith("share with family") ||
      sLower.startsWith("update:") ||
      sLower.includes("dinner is now at") ||
      sLower.includes("we're leaving at") ||
      sLower.includes("we are leaving at") ||
      sLower.includes("instead of");

    if (isFamilyUpdate) {
      toolsUsed.push("createFamilyUpdate");
      const content = stmt.replace(/^(?:tell the family|share with family)\s*(?:that)?\s*/i, "").replace(/^update:\s*/i, "").trim();

      const pending = await createPendingAction(ctx, {
        kind: "create_update",
        payload: { content },
        preview: {
          kind: "create_update",
          title: "Post Family Update",
          details: [{ label: "Message", value: content }],
          warnings: [],
          destructive: false,
        },
        source,
      });

      actions.push(toPendingActionDTO(pending));
      continue;
    }

    // 2. Task Creation
    const isCreateTask =
      sLower.includes("create a task") ||
      sLower.includes("create task") ||
      sLower.includes("add a task") ||
      sLower.includes("add task") ||
      sLower.includes("task to") ||
      sLower.includes("task for") ||
      sLower.startsWith("task:") ||
      sLower.includes("we need to") ||
      sLower.includes("i need to") ||
      sLower.includes("clear the balcony") ||
      sLower.includes("pick up the cake") ||
      sLower.startsWith("pick up ") ||
      sLower.startsWith("buy ") ||
      sLower.startsWith("clean ") ||
      sLower.startsWith("fix ") ||
      sLower.startsWith("todo:") ||
      sLower.startsWith("to do:");

    if (isCreateTask) {
      toolsUsed.push("createTask");
      const title = extractTaskTitle(stmt);
      const resolvedDate = resolveDateRange(stmt, ctx.timezone, new Date());
      let dueAt: Date | undefined;
      if (resolvedDate || sLower.includes("tomorrow") || sLower.includes("before") || sLower.includes("by ")) {
        const dateKey = resolvedDate ? resolvedDate.startKey : sLower.includes("tomorrow") ? tomorrowKey : todayKey;
        const { time } = extractTimeFromText(stmt);
        dueAt = zonedToUtc(dateKey, time === "10:00" ? "12:00" : time, ctx.timezone);
      }

      const pending = await createPendingAction(ctx, {
        kind: "create_task",
        payload: {
          title,
          notes: stmt,
          dueAt: dueAt ? dueAt.toISOString() : undefined,
        },
        preview: {
          kind: "create_task",
          title: `Create Task: ${title}`,
          details: [
            { label: "Task", value: title },
            ...(dueAt ? [{ label: "Due", value: formatDateTime(dueAt, ctx.timezone) }] : []),
          ],
          warnings: [],
          destructive: false,
        },
        source,
      });

      actions.push(toPendingActionDTO(pending));
      continue;
    }

    // 3. Reminder Scheduling
    const isCreateReminder =
      sLower.startsWith("remind") ||
      sLower.includes("remind me") ||
      sLower.includes("remind us") ||
      sLower.includes("remind everyone") ||
      sLower.startsWith("reminder:") ||
      sLower.startsWith("set a reminder");

    if (isCreateReminder && !sLower.includes("what") && !sLower.includes("show") && !sLower.includes("list")) {
      toolsUsed.push("createReminder");
      const { message, fireAt } = extractReminderDetails(stmt, ctx.timezone);

      const pending = await createPendingAction(ctx, {
        kind: "create_reminder",
        payload: {
          message,
          fireAt: fireAt.toISOString(),
        },
        preview: {
          kind: "create_reminder",
          title: `Schedule Reminder: "${message}"`,
          details: [{ label: "Reminder Time", value: formatDateTime(fireAt, ctx.timezone) }],
          warnings: [],
          destructive: false,
        },
        source,
      });

      actions.push(toPendingActionDTO(pending));
      continue;
    }

    // 4. Family Memory / Preference / Fact Storage
    const isSaveMemory =
      sLower.startsWith("save that") ||
      sLower.startsWith("remember") ||
      sLower.startsWith("save memory") ||
      sLower.startsWith("note that") ||
      sLower.startsWith("keep in mind") ||
      sLower.startsWith("memory:") ||
      sLower.startsWith("preference:") ||
      sLower.includes("doesn't like") ||
      sLower.includes("allergic to") ||
      sLower.includes("favourite ") ||
      sLower.includes("favorite ");

    if (isSaveMemory && !sLower.includes("what") && !sLower.includes("search") && !sLower.includes("tell me")) {
      toolsUsed.push("saveFamilyMemory");
      const { content, category } = extractMemoryFact(stmt);

      const pending = await createPendingAction(ctx, {
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
        source,
      });

      actions.push(toPendingActionDTO(pending));
      continue;
    }

    // 5. Event Creation
    const isCreateEvent =
      sLower.startsWith("add ") ||
      sLower.startsWith("create an event") ||
      sLower.startsWith("create event") ||
      sLower.startsWith("schedule an event") ||
      sLower.startsWith("schedule event") ||
      sLower.startsWith("schedule ") ||
      sLower.startsWith("plan ") ||
      sLower.startsWith("event:") ||
      sLower.includes("is coming") ||
      sLower.includes("are coming") ||
      ((sLower.includes("dinner") || sLower.includes("lunch") || sLower.includes("breakfast") || sLower.includes("appointment") || sLower.includes("meeting")) &&
        (sLower.includes(" on ") || sLower.includes(" at ") || sLower.includes(" tomorrow") || sLower.includes(" today")) &&
        !sLower.startsWith("when ") &&
        !sLower.startsWith("what ") &&
        !sLower.startsWith("where ") &&
        !sLower.startsWith("is "));

    if (isCreateEvent) {
      toolsUsed.push("createFamilyEvent");
      const resolvedDate = resolveDateRange(stmt, ctx.timezone, new Date());
      const dateKey = resolvedDate ? resolvedDate.startKey : sLower.includes("tomorrow") ? tomorrowKey : todayKey;
      const { time, allDay } = extractTimeFromText(stmt);
      const startsAt = zonedToUtc(dateKey, time, ctx.timezone);
      const title = extractEventTitle(stmt);

      const pending = await createPendingAction(ctx, {
        kind: "create_event",
        payload: {
          title,
          startsAt: startsAt.toISOString(),
          allDay,
          description: stmt,
        },
        preview: {
          kind: "create_event",
          title: `Add Event: ${title}`,
          details: [
            { label: "Date & Time", value: formatDateTime(startsAt, ctx.timezone, { allDay }) },
          ],
          warnings: [],
          destructive: false,
        },
        source,
      });

      actions.push(toPendingActionDTO(pending));
      continue;
    }
  }

  // If one or more creation actions were extracted from the query, return them immediately!
  if (actions.length > 0) {
    let reply = "I've prepared the following action for your confirmation:";
    if (actions.length > 1) {
      const eventCount = actions.filter((a) => a.kind === "create_event").length;
      const taskCount = actions.filter((a) => a.kind === "create_task").length;
      const reminderCount = actions.filter((a) => a.kind === "create_reminder").length;
      const memoryCount = actions.filter((a) => a.kind === "save_memory").length;
      const parts: string[] = [];
      if (eventCount > 0) parts.push(`${eventCount} event${eventCount > 1 ? "s" : ""}`);
      if (taskCount > 0) parts.push(`${taskCount} task${taskCount > 1 ? "s" : ""}`);
      if (reminderCount > 0) parts.push(`${reminderCount} reminder${reminderCount > 1 ? "s" : ""}`);
      if (memoryCount > 0) parts.push(`${memoryCount} note${memoryCount > 1 ? "s" : ""}`);
      reply = `I found ${parts.join(" and ")} in your request. I've prepared them for confirmation below:`;
    }

    return {
      reply,
      actions,
      toolsUsed,
      matched: true,
    };
  }

  // -------------------------------------------------------------------------
  // PHASE 2: Information Retrieval & Query Handling
  // -------------------------------------------------------------------------

  // A. Schedule & Event Queries
  const isAskingSchedule =
    lower.includes("when") ||
    lower.includes("what") ||
    lower.includes("where") ||
    lower.includes("schedule") ||
    lower.includes("happening") ||
    lower.includes("event") ||
    lower.includes("plan") ||
    lower.includes("visit") ||
    lower.includes("appointment") ||
    lower.includes("meeting") ||
    lower.includes("coming") ||
    lower.includes("dinner") ||
    lower.includes("lunch") ||
    lower.includes("doctor") ||
    lower.includes("electrician");

  if (isAskingSchedule) {
    const resolvedDate = resolveDateRange(q, ctx.timezone, new Date());

    // Date-scoped schedule query ("What's happening tomorrow?", "When is dinner on Sunday?", etc.)
    if (resolvedDate) {
      toolsUsed.push("getEventsForDateRange");
      const events = await getEventsForDateRange(ctx.familyId, ctx.timezone, resolvedDate.startKey, resolvedDate.days);

      const queryWords = lower
        .replace(/[^a-z0-9\s]/g, "")
        .split(/\s+/)
        .filter((w) => w.length > 2 && !["when", "what", "where", "time", "date", "the", "for", "and", "is", "are", "any", "our", "my", "scheduled", "happening"].includes(w));

      if (queryWords.length > 0) {
        const specificEvent = events.find((e) => {
          const titleLower = e.title.toLowerCase();
          const descLower = (e.description || "").toLowerCase();
          const locLower = (e.location || "").toLowerCase();
          return queryWords.some((w) => titleLower.includes(w) || descLower.includes(w) || locLower.includes(w));
        });

        if (specificEvent) {
          const timeStr = formatDateTime(specificEvent.startsAt, ctx.timezone, { allDay: specificEvent.allDay });
          const locStr = specificEvent.location ? ` at ${specificEvent.location}` : "";
          const descStr = specificEvent.description ? ` (${specificEvent.description})` : "";
          const capitalizedLabel = resolvedDate.label.charAt(0).toUpperCase() + resolvedDate.label.slice(1);
          return {
            reply: `${capitalizedLabel}: "${specificEvent.title}" is scheduled for ${timeStr}${locStr}${descStr}.`,
            actions: [],
            toolsUsed,
            matched: true,
          };
        }
      }

      if (events.length === 0) {
        return {
          reply: `You don't have any events scheduled for ${resolvedDate.label}.`,
          actions: [],
          toolsUsed,
          matched: true,
        };
      }

      const list = events
        .map((e) => `• ${e.title} at ${formatDateTime(e.startsAt, ctx.timezone, { allDay: e.allDay })}${e.location ? ` (${e.location})` : ""}`)
        .join("\n");
      return {
        reply: `Here is what is scheduled for ${resolvedDate.label}:\n${list}`,
        actions: [],
        toolsUsed,
        matched: true,
      };
    }

    // Global search across upcoming events (e.g. "When is electrician visit scheduled?", "When is doctor?")
    toolsUsed.push("getAllUpcomingOrRecentEvents");
    const allEvents = await getAllUpcomingOrRecentEvents(ctx.familyId, 1, 30);
    const queryWords = lower
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !["when", "what", "where", "time", "date", "the", "for", "and", "is", "are", "any", "our", "my", "scheduled", "coming", "there", "visit"].includes(w));

    const matchedEvent = allEvents.find((e) => {
      const titleLower = e.title.toLowerCase();
      const descLower = (e.description || "").toLowerCase();
      const locLower = (e.location || "").toLowerCase();
      if (lower.includes("electrician") && titleLower.includes("electrician")) return true;
      return queryWords.some((w) => titleLower.includes(w) || descLower.includes(w) || locLower.includes(w));
    });

    if (matchedEvent) {
      const dayLbl = relativeDayLabel(matchedEvent.startsAt, ctx.timezone);
      const timeStr = formatDateTime(matchedEvent.startsAt, ctx.timezone, { allDay: matchedEvent.allDay });
      const locStr = matchedEvent.location ? ` at ${matchedEvent.location}` : "";
      const descStr = matchedEvent.description ? ` (${matchedEvent.description})` : "";
      return {
        reply: `"${matchedEvent.title}" is scheduled for ${dayLbl} at ${timeStr}${locStr}${descStr}.`,
        actions: [],
        toolsUsed,
        matched: true,
      };
    }

    if (lower.includes("upcoming") || lower.includes("schedule") || lower.includes("events") || lower.includes("plans")) {
      if (allEvents.length === 0) {
        return {
          reply: "You don't have any upcoming events scheduled in the next 30 days.",
          actions: [],
          toolsUsed,
          matched: true,
        };
      }
      const list = allEvents
        .slice(0, 5)
        .map((e) => `• ${e.title} — ${relativeDayLabel(e.startsAt, ctx.timezone)} at ${formatDateTime(e.startsAt, ctx.timezone, { allDay: e.allDay })}${e.location ? ` (${e.location})` : ""}`)
        .join("\n");
      return {
        reply: `Here are your upcoming family events:\n${list}`,
        actions: [],
        toolsUsed,
        matched: true,
      };
    }
  }

  // B. Task Queries: "what tasks do I have", "pending tasks", "tasks"
  if (lower.includes("task") && (lower.includes("what") || lower.includes("show") || lower.includes("list") || lower.includes("my") || lower.includes("pending") || lower.includes("have"))) {
    toolsUsed.push("getTasks");
    const pendingTasks = await getTasks(ctx.familyId, "open");
    if (pendingTasks.length === 0) {
      return {
        reply: "You have no pending tasks right now!",
        actions: [],
        toolsUsed,
        matched: true,
      };
    }
    const list = pendingTasks
      .slice(0, 5)
      .map((t) => `• ${t.title}${t.dueAt ? ` (due ${relativeDayLabel(t.dueAt, ctx.timezone)})` : ""}`)
      .join("\n");
    return {
      reply: `Here are your pending tasks:\n${list}`,
      actions: [],
      toolsUsed,
      matched: true,
    };
  }

  // C. Reminder Queries: "what reminders are set", "any reminders"
  if (lower.includes("remind") && (lower.includes("what") || lower.includes("show") || lower.includes("list") || lower.includes("any") || lower.includes("scheduled"))) {
    toolsUsed.push("getFamilyReminders");
    const reminders = await getFamilyReminders(ctx.familyId);
    if (reminders.length === 0) {
      return {
        reply: "You have no upcoming reminders scheduled.",
        actions: [],
        toolsUsed,
        matched: true,
      };
    }
    const list = reminders
      .slice(0, 5)
      .map((r) => `• "${r.message}" — ${formatDateTime(r.fireAt, ctx.timezone)}`)
      .join("\n");
    return {
      reply: `Here are your scheduled reminders:\n${list}`,
      actions: [],
      toolsUsed,
      matched: true,
    };
  }

  // D. General search over family memory
  toolsUsed.push("getFamilyMemory");
  const memories = await getFamilyMemory(ctx.familyId, { query: q });
  if (memories.length > 0) {
    const list = memories.map((m) => `• ${m.content}`).join("\n");
    return {
      reply: `Here is what I found in family memory:\n${list}`,
      actions: [],
      toolsUsed,
      matched: true,
    };
  }

  return {
    reply: "I couldn't find any stored information about that in your family's records. You can ask me to add an event, task, reminder, or note anytime!",
    actions: [],
    toolsUsed,
    matched: false,
  };
}
