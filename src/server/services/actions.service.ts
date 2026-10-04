import { ObjectId } from "mongodb";
import { collections } from "../db/client";
import type { ActionKind, ActionPreview, PendingActionDoc } from "../db/types";
import { invalid, notFound } from "../errors";
import type { AuthContext } from "../context";
import { toObjectId } from "../context";
import { createFamilyEvent, updateFamilyEvent, deleteFamilyEvent } from "./events.service";
import { createTask, assignTask, completeTask } from "./tasks.service";
import { createReminder, cancelReminder } from "./reminders.service";
import { createFamilyUpdate } from "./updates.service";
import { saveFamilyMemory } from "./memories.service";
import type { PendingActionDTO } from "@/lib/types";

export function toPendingActionDTO(doc: PendingActionDoc): PendingActionDTO {
  return {
    id: doc._id.toHexString(),
    kind: doc.kind,
    preview: doc.preview,
    status: doc.status,
    result: doc.result,
  };
}

export async function createPendingAction(
  ctx: AuthContext,
  data: {
    kind: ActionKind;
    payload: Record<string, unknown>;
    preview: ActionPreview;
    source: "ask" | "voice";
  }
): Promise<PendingActionDoc> {
  const { pendingActions } = await collections();

  const doc: PendingActionDoc = {
    _id: new ObjectId(),
    familyId: ctx.familyId,
    userId: ctx.userId,
    kind: data.kind,
    payload: data.payload,
    preview: data.preview,
    status: "pending",
    result: null,
    source: data.source,
    createdAt: new Date(),
    resolvedAt: null,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
  };

  await pendingActions.insertOne(doc);
  return doc;
}

export async function confirmPendingAction(
  ctx: AuthContext,
  actionId: string
): Promise<{ success: boolean; message: string; entityId: string | null }> {
  const oActionId = toObjectId(actionId, "pending action");
  const { pendingActions } = await collections();

  const action = await pendingActions.findOne({
    _id: oActionId,
    familyId: ctx.familyId,
  });

  if (!action) throw notFound("action");
  if (action.status !== "pending") {
    throw invalid(`Action is already ${action.status}`);
  }

  let entityId: string | null = null;
  let message = "";

  try {
    switch (action.kind) {
      case "create_event": {
        const payload = action.payload as any;
        const event = await createFamilyEvent(ctx, {
          title: payload.title,
          startsAt: new Date(payload.startsAt),
          allDay: payload.allDay,
          description: payload.description,
          location: payload.location,
        });
        entityId = event._id.toHexString();
        message = `Event "${event.title}" has been added.`;
        break;
      }

      case "update_event": {
        const payload = action.payload as any;
        const event = await updateFamilyEvent(ctx, payload.eventId, {
          title: payload.title,
          startsAt: payload.startsAt ? new Date(payload.startsAt) : undefined,
          allDay: payload.allDay,
          description: payload.description,
          location: payload.location,
        });
        entityId = event._id.toHexString();
        message = `Event "${event.title}" has been updated.`;
        break;
      }

      case "delete_event": {
        const payload = action.payload as any;
        await deleteFamilyEvent(ctx, payload.eventId);
        message = "Event has been removed.";
        break;
      }

      case "create_task": {
        const payload = action.payload as any;
        const task = await createTask(ctx, {
          title: payload.title,
          notes: payload.notes,
          dueAt: payload.dueAt ? new Date(payload.dueAt) : null,
          assigneeName: payload.assigneeName,
          assigneeMemberId: payload.assigneeMemberId,
          relatedEventId: payload.relatedEventId,
        });
        entityId = task._id.toHexString();
        message = `Task "${task.title}" has been created.`;
        break;
      }

      case "assign_task": {
        const payload = action.payload as any;
        const task = await assignTask(ctx, payload.taskId, {
          memberName: payload.memberName,
          memberId: payload.memberId,
        });
        entityId = task._id.toHexString();
        message = `Task "${task.title}" assigned.`;
        break;
      }

      case "complete_task": {
        const payload = action.payload as any;
        const task = await completeTask(ctx, payload.taskId);
        entityId = task._id.toHexString();
        message = `Task "${task.title}" marked as completed.`;
        break;
      }

      case "create_reminder": {
        const payload = action.payload as any;
        const reminder = await createReminder(ctx, {
          message: payload.message,
          fireAt: new Date(payload.fireAt),
          audienceMemberIds: payload.audienceMemberIds,
          relatedEventId: payload.relatedEventId,
        });
        entityId = reminder._id.toHexString();
        message = `Reminder scheduled for ${reminder.fireAt.toLocaleString()}.`;
        break;
      }

      case "cancel_reminder": {
        const payload = action.payload as any;
        await cancelReminder(ctx, payload.reminderId);
        message = "Reminder has been cancelled.";
        break;
      }

      case "create_update": {
        const payload = action.payload as any;
        const update = await createFamilyUpdate(ctx, payload.content, action.source === "voice" ? "voice" : "text");
        entityId = update._id.toHexString();
        message = "Family update shared.";
        break;
      }

      case "save_memory": {
        const payload = action.payload as any;
        const memory = await saveFamilyMemory(ctx, {
          content: payload.content,
          category: payload.category,
          source: action.source === "voice" ? "voice" : "assistant",
        });
        entityId = memory._id.toHexString();
        message = "Family memory saved.";
        break;
      }

      default:
        throw invalid(`Unknown action kind: ${(action as any).kind}`);
    }

    await pendingActions.updateOne(
      { _id: oActionId },
      {
        $set: {
          status: "confirmed",
          resolvedAt: new Date(),
          result: { entityId, message },
        },
      }
    );

    return { success: true, message, entityId };
  } catch (err: any) {
    await pendingActions.updateOne(
      { _id: oActionId },
      {
        $set: {
          status: "failed",
          resolvedAt: new Date(),
          result: { entityId: null, message: err?.message || "Execution failed" },
        },
      }
    );
    throw err;
  }
}

export async function dismissPendingAction(ctx: AuthContext, actionId: string): Promise<void> {
  const oActionId = toObjectId(actionId, "pending action");
  const { pendingActions } = await collections();

  await pendingActions.updateOne(
    { _id: oActionId, familyId: ctx.familyId },
    { $set: { status: "dismissed", resolvedAt: new Date() } }
  );
}
