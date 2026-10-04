import { ObjectId } from "mongodb";
import { collections } from "../db/client";
import type { ReminderDoc } from "../db/types";
import { AppError, invalid, notFound, USER_MESSAGES } from "../errors";
import type { AuthContext } from "../context";
import { toObjectId } from "../context";
import { getTemporalClient } from "../temporal/client";
import { env } from "../env";
import { logActivity } from "./family.service";
import { formatDateTime } from "@/lib/time";
import type { ReminderDTO } from "@/lib/types";

export function toReminderDTO(doc: ReminderDoc, tz: string): ReminderDTO {
  return {
    id: doc._id.toHexString(),
    message: doc.message,
    fireAt: doc.fireAt.toISOString(),
    fireLabel: formatDateTime(doc.fireAt, tz),
    audience: doc.audienceMemberIds.length === 0 ? "Everyone" : `${doc.audienceMemberIds.length} members`,
    status: doc.status,
    failureReason: doc.failureReason,
    deliveredAt: doc.deliveredAt ? doc.deliveredAt.toISOString() : null,
  };
}

export async function createReminder(
  ctx: AuthContext,
  data: {
    message: string;
    fireAt: Date;
    audienceMemberIds?: string[];
    relatedEventId?: string;
  }
): Promise<ReminderDoc> {
  if (!data.message?.trim()) throw invalid("Reminder message is required");
  if (!data.fireAt || isNaN(data.fireAt.getTime())) throw invalid("Valid fireAt time is required");
  if (data.fireAt.getTime() <= Date.now() - 60000) {
    throw invalid("Reminder time must be in the future");
  }

  const { reminders } = await collections();
  const reminderId = new ObjectId();
  const workflowId = `kutumb-reminder-${reminderId.toHexString()}`;

  const doc: ReminderDoc = {
    _id: reminderId,
    familyId: ctx.familyId,
    message: data.message.trim(),
    fireAt: data.fireAt,
    audienceMemberIds: (data.audienceMemberIds || []).map((id) => toObjectId(id, "audience member")),
    relatedEventId: data.relatedEventId ? toObjectId(data.relatedEventId, "related event") : null,
    status: "scheduling",
    workflowId,
    failureReason: null,
    createdBy: ctx.userId,
    createdAt: new Date(),
    updatedAt: new Date(),
    deliveredAt: null,
    cancelledAt: null,
  };

  await reminders.insertOne(doc);

  // Now schedule with Temporal
  try {
    const temporal = await getTemporalClient();
    await temporal.workflow.start("reminderWorkflow", {
      taskQueue: env.temporalTaskQueue(),
      workflowId,
      args: [
        {
          reminderId: reminderId.toHexString(),
          familyId: ctx.familyId.toHexString(),
          fireAtIso: data.fireAt.toISOString(),
        },
      ],
    });

    await reminders.updateOne(
      { _id: reminderId },
      { $set: { status: "scheduled", updatedAt: new Date() } }
    );
    doc.status = "scheduled";

    const whenStr = formatDateTime(doc.fireAt, ctx.timezone);
    await logActivity(
      ctx.familyId,
      { userId: ctx.userId, name: ctx.userName },
      "reminder_scheduled",
      `${ctx.userName} scheduled a reminder: "${doc.message}" for ${whenStr}`,
      { type: "reminder", id: reminderId }
    );

    return doc;
  } catch (err: any) {
    const reason = err?.message || "Temporal scheduling failed";
    await reminders.updateOne(
      { _id: reminderId },
      { $set: { status: "failed", failureReason: reason, updatedAt: new Date() } }
    );

    // PRD: "If Temporal fails: do not claim a reminder was successfully scheduled unless it actually was."
    throw new AppError("reminders_unavailable", USER_MESSAGES.reminders, { cause: err });
  }
}

export async function cancelReminder(ctx: AuthContext, reminderId: string): Promise<ReminderDoc> {
  const oReminderId = toObjectId(reminderId, "reminder");
  const { reminders } = await collections();

  const existing = await reminders.findOne({ _id: oReminderId, familyId: ctx.familyId });
  if (!existing) throw notFound("reminder");

  if (existing.status === "scheduled" && existing.workflowId) {
    try {
      const temporal = await getTemporalClient();
      const handle = temporal.workflow.getHandle(existing.workflowId);
      await handle.cancel();
    } catch (err) {
      console.warn(`[Temporal] Failed to cancel workflow ${existing.workflowId}:`, err);
    }
  }

  await reminders.updateOne(
    { _id: oReminderId, familyId: ctx.familyId },
    {
      $set: {
        status: "cancelled",
        cancelledAt: new Date(),
        updatedAt: new Date(),
      },
    }
  );

  await logActivity(
    ctx.familyId,
    { userId: ctx.userId, name: ctx.userName },
    "reminder_cancelled",
    `${ctx.userName} cancelled reminder: "${existing.message}"`,
    { type: "reminder", id: oReminderId }
  );

  return (await reminders.findOne({ _id: oReminderId }))!;
}

export async function getFamilyReminders(familyId: ObjectId, status?: ReminderDoc["status"]): Promise<ReminderDoc[]> {
  const { reminders } = await collections();
  const filter: any = { familyId };
  if (status) filter.status = status;

  return reminders.find(filter).sort({ fireAt: 1 }).toArray();
}
