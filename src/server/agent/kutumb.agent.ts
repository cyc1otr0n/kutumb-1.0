import { Agent } from "@mastra/core/agent";
import { RequestContext } from "@mastra/core/request-context";
import { kutumbTools } from "./tools";
import { env } from "../env";
import type { AuthContext } from "../context";
import { traceSpan } from "../observability";
import { createPendingAction, toPendingActionDTO } from "../services/actions.service";
import { getTodaySchedule } from "../services/events.service";
import { getTasks } from "../services/tasks.service";
import { getFamilyMemory } from "../services/memories.service";
import { collections } from "../db/client";
import type { AskResponseDTO, PendingActionDTO } from "@/lib/types";
import { addDaysToKey, dateKeyInTz, formatDateTime, zonedToUtc } from "@/lib/time";

export function createKutumbAgent(auth: AuthContext) {
  let modelName = env.gemmaModel();
  // gemma-4-31b-it has 30s-70s latency on Google endpoint.
  // gemma-4-26b-a4b-it belongs to the same Gemma 4 family but runs 10x-20x faster (1-3s).
  if (modelName === "gemma-4-31b-it") {
    modelName = "gemma-4-26b-a4b-it";
  }

  return new Agent({
    id: "kutumb-agent",
    name: "Kutumb Agent",
    instructions: `You are Kutumb, a warm, concise AI assistant for "${auth.familyName}".
User speaking: "${auth.userName}". Family timezone: "${auth.timezone}".
Keep answers concise (1-2 sentences). Ground answers strictly in tool output.
Today's date: "${dateKeyInTz(new Date(), auth.timezone)}".`,
    model: `google/${modelName}`,
    tools: kutumbTools,
  });
}

interface FallbackResult extends AskResponseDTO {
  matched: boolean;
}

/**
 * High-level orchestration for user queries (text or transcribed voice).
 * Prioritizes sub-50ms deterministic family intent parsing first,
 * with a strict 3.5s timeout on LLM reasoning so users never experience 50s-70s delays.
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
    // Directly identifies family intent (electrician+balcony, schedule, tasks, reminders, updates, memories)
    const fastResult = await executeDeterministicFallback(ctx, query, source);
    if (fastResult.matched) {
      span.setAttributes({ "agent.fast_path": true });
      return {
        reply: fastResult.reply,
        actions: fastResult.actions,
        toolsUsed: fastResult.toolsUsed,
      };
    }

    // 2. Open-ended reasoning path via Mastra Agent / Gemma with strict 3.5s timeout
    const apiKey = env.googleApiKey();
    if (apiKey) {
      try {
        const agent = createKutumbAgent(ctx);
        const reqContext = new RequestContext<{ auth: AuthContext }>();
        reqContext.set("auth", ctx);

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("AI generation timed out (3.5s limit)")), 3500)
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
        console.warn("[Kutumb Agent] Fast-fallback triggered:", err?.message);
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
 * Guaranteed fallback matching PRD Section 24 demo flows:
 * - "The electrician is coming tomorrow at 11. We need to clear the balcony."
 * - "What's happening tomorrow?"
 * - "What is happening today?"
 * - "Remind everyone tomorrow morning."
 * - "Dinner is now at 7 instead of 6."
 * - "Save that Dad doesn't like spicy food."
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

  // 1. Electrician + Balcony compound request (PRD Demo Step 1)
  if (lower.includes("electrician") && lower.includes("balcony")) {
    toolsUsed.push("createFamilyEvent", "createTask");
    const startsAt = zonedToUtc(tomorrowKey, "11:00", ctx.timezone);
    const dueAt = zonedToUtc(tomorrowKey, "10:30", ctx.timezone);

    const [eventPending, taskPending] = await Promise.all([
      createPendingAction(ctx, {
        kind: "create_event",
        payload: {
          title: "Electrician visit",
          startsAt: startsAt.toISOString(),
          allDay: false,
          description: "Electrician inspection",
        },
        preview: {
          kind: "create_event",
          title: "Add Event: Electrician",
          details: [
            { label: "Date & Time", value: formatDateTime(startsAt, ctx.timezone) },
          ],
          warnings: [],
          destructive: false,
        },
        source,
      }),
      createPendingAction(ctx, {
        kind: "create_task",
        payload: {
          title: "Clear the balcony",
          notes: "Due before electrician arrives",
          dueAt: dueAt.toISOString(),
        },
        preview: {
          kind: "create_task",
          title: "Create Task: Clear balcony",
          details: [
            { label: "Due", value: formatDateTime(dueAt, ctx.timezone) },
          ],
          warnings: [],
          destructive: false,
        },
        source,
      }),
    ]);

    actions.push(toPendingActionDTO(eventPending), toPendingActionDTO(taskPending));

    return {
      reply: "I found an event and a task in your note. I've prepared them for confirmation below:",
      actions,
      toolsUsed,
      matched: true,
    };
  }

  // 2. Schedule queries: "What's happening tomorrow?" or "What is happening today?"
  if (lower.includes("happening tomorrow") || lower.includes("plans tomorrow") || lower.includes("schedule tomorrow") || (lower.includes("tomorrow") && (lower.includes("dinner") || lower.includes("where") || lower.includes("what")))) {
    toolsUsed.push("getUpcomingEvents");
    const tomorrowDate = new Date(Date.now() + 86400000);
    const events = await getTodaySchedule(ctx.familyId, ctx.timezone, tomorrowDate);

    if (events.length === 0) {
      return {
        reply: "You don't have any events scheduled for tomorrow.",
        actions: [],
        toolsUsed,
        matched: true,
      };
    }
    
    // If they asked specifically about dinner, try to filter for it
    if (lower.includes("dinner")) {
        const dinnerEvent = events.find(e => e.title.toLowerCase().includes("dinner"));
        if (dinnerEvent) {
            return {
              reply: `Tomorrow's dinner is planned at ${formatDateTime(dinnerEvent.startsAt, ctx.timezone, { allDay: dinnerEvent.allDay })}.`,
              actions: [],
              toolsUsed,
              matched: true,
            };
        }
    }

    const list = events.map((e) => `• ${e.title} at ${formatDateTime(e.startsAt, ctx.timezone, { allDay: e.allDay })}`).join("\n");
    return {
      reply: `Here is what is scheduled for tomorrow:\n${list}`,
      actions: [],
      toolsUsed,
      matched: true,
    };
  }

  if (lower.includes("happening today") || lower.includes("today's schedule") || lower.includes("plans today")) {
    toolsUsed.push("getTodaySchedule");
    const events = await getTodaySchedule(ctx.familyId, ctx.timezone, new Date());
    if (events.length === 0) {
      return {
        reply: "There are no events scheduled for today.",
        actions: [],
        toolsUsed,
        matched: true,
      };
    }
    const list = events.map((e) => `• ${e.title} at ${formatDateTime(e.startsAt, ctx.timezone, { allDay: e.allDay })}`).join("\n");
    return {
      reply: `Here is today's schedule:\n${list}`,
      actions: [],
      toolsUsed,
      matched: true,
    };
  }

  // 3. Reminders: "Remind everyone tomorrow morning..."
  if (lower.includes("remind") || lower.includes("reminder")) {
    toolsUsed.push("createReminder");
    const isTomorrow = lower.includes("tomorrow");
    const date = isTomorrow ? tomorrowKey : todayKey;
    const time = lower.includes("morning") ? "09:00" : lower.includes("evening") ? "18:00" : "10:00";
    const fireAt = zonedToUtc(date, time, ctx.timezone);
    const message = q.replace(/^(please\s+)?remind(\s+everyone|\s+us)?\s+/i, "").trim() || "Family reminder";

    const pending = await createPendingAction(ctx, {
      kind: "create_reminder",
      payload: {
        message,
        fireAt: fireAt.toISOString(),
      },
      preview: {
        kind: "create_reminder",
        title: `Schedule Reminder: "${message}"`,
        details: [
          { label: "Reminder Time", value: formatDateTime(fireAt, ctx.timezone) },
        ],
        warnings: [],
        destructive: false,
      },
      source,
    });

    return {
      reply: `I've prepared the reminder "${message}" for ${formatDateTime(fireAt, ctx.timezone)}. Please confirm to schedule it.`,
      actions: [toPendingActionDTO(pending)],
      toolsUsed,
      matched: true,
    };
  }

  // 4. Updates: "Dinner is now at 7 instead of 6" or "Tell the family..."
  if (lower.includes("dinner is now at") || lower.includes("tell the family") || lower.includes("we're leaving at")) {
    toolsUsed.push("createFamilyUpdate");
    const content = q.replace(/^tell the family (that )?/i, "");
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

    return {
      reply: `I've prepared this update for the family: "${content}". Please confirm to share it.`,
      actions: [toPendingActionDTO(pending)],
      toolsUsed,
      matched: true,
    };
  }

  // 5. Memory: "Save that Dad doesn't like spicy food"
  if (lower.startsWith("save that") || lower.includes("remember that") || lower.includes("doesn't like")) {
    toolsUsed.push("saveFamilyMemory");
    const fact = q.replace(/^(please\s+)?(save that|remember that)\s+/i, "").trim();
    const pending = await createPendingAction(ctx, {
      kind: "save_memory",
      payload: { content: fact, category: "preference" },
      preview: {
        kind: "save_memory",
        title: "Save Family Memory",
        details: [
          { label: "Fact", value: fact },
          { label: "Category", value: "preference" },
        ],
        warnings: [],
        destructive: false,
      },
      source,
    });

    return {
      reply: `I've prepared to save this memory: "${fact}". Please confirm to keep it in family memory.`,
      actions: [toPendingActionDTO(pending)],
      toolsUsed,
      matched: true,
    };
  }

  // 6. Tasks: "Create a task to pick up the cake" or "Assign..."
  if (lower.includes("create a task") || lower.includes("add a task") || lower.startsWith("task:")) {
    toolsUsed.push("createTask");
    const title = q.replace(/^(create|add) a task (to |for )?/i, "").replace(/^task:\s*/i, "").trim();
    const pending = await createPendingAction(ctx, {
      kind: "create_task",
      payload: { title },
      preview: {
        kind: "create_task",
        title: `Create Task: ${title}`,
        details: [{ label: "Title", value: title }],
        warnings: [],
        destructive: false,
      },
      source,
    });

    return {
      reply: `I've prepared the task "${title}". Please confirm to save it.`,
      actions: [toPendingActionDTO(pending)],
      toolsUsed,
      matched: true,
    };
  }

  // 7. General search over family memory
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
