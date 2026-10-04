import { ObjectId } from "mongodb";
import { collections } from "../db/client";
import type { TaskDoc } from "../db/types";
import { invalid, notFound } from "../errors";
import type { AuthContext } from "../context";
import { toObjectId } from "../context";
import { findMemberByName, logActivity } from "./family.service";
import { relativeDayLabel } from "@/lib/time";
import type { TaskDTO } from "@/lib/types";

export async function toTaskDTO(doc: TaskDoc, tz: string): Promise<TaskDTO> {
  const { members } = await collections();
  let assigneeName: string | null = null;
  if (doc.assigneeMemberId) {
    const member = await members.findOne({ _id: doc.assigneeMemberId });
    assigneeName = member ? member.name : null;
  }

  return {
    id: doc._id.toHexString(),
    title: doc.title,
    notes: doc.notes,
    dueAt: doc.dueAt ? doc.dueAt.toISOString() : null,
    dueLabel: doc.dueAt ? relativeDayLabel(doc.dueAt, tz) : null,
    assigneeId: doc.assigneeMemberId ? doc.assigneeMemberId.toHexString() : null,
    assigneeName,
    status: doc.status,
    relatedEventId: doc.relatedEventId ? doc.relatedEventId.toHexString() : null,
    completedAt: doc.completedAt ? doc.completedAt.toISOString() : null,
  };
}

export async function createTask(
  ctx: AuthContext,
  data: {
    title: string;
    notes?: string;
    dueAt?: Date | null;
    assigneeMemberId?: string | null;
    assigneeName?: string | null;
    relatedEventId?: string | null;
  }
): Promise<TaskDoc> {
  if (!data.title?.trim()) throw invalid("Task title is required");

  let assigneeId: ObjectId | null = null;
  if (data.assigneeMemberId) {
    assigneeId = toObjectId(data.assigneeMemberId, "assignee");
  } else if (data.assigneeName) {
    const member = await findMemberByName(ctx.familyId, data.assigneeName);
    if (member) assigneeId = member._id;
  }

  const { tasks } = await collections();
  const doc: TaskDoc = {
    _id: new ObjectId(),
    familyId: ctx.familyId,
    title: data.title.trim(),
    notes: data.notes?.trim() || null,
    dueAt: data.dueAt || null,
    assigneeMemberId: assigneeId,
    relatedEventId: data.relatedEventId ? toObjectId(data.relatedEventId, "related event") : null,
    status: "open",
    createdBy: ctx.userId,
    createdAt: new Date(),
    updatedAt: new Date(),
    completedAt: null,
    completedBy: null,
  };

  await tasks.insertOne(doc);

  await logActivity(
    ctx.familyId,
    { userId: ctx.userId, name: ctx.userName },
    "task_created",
    `${ctx.userName} created task: "${doc.title}"`,
    { type: "task", id: doc._id }
  );

  return doc;
}

export async function assignTask(
  ctx: AuthContext,
  taskId: string,
  assignee: { memberId?: string; memberName?: string }
): Promise<TaskDoc> {
  const oTaskId = toObjectId(taskId, "task");
  const { tasks, members } = await collections();

  const existing = await tasks.findOne({ _id: oTaskId, familyId: ctx.familyId });
  if (!existing) throw notFound("task");

  let targetMemberId: ObjectId | null = null;
  let targetMemberName = "someone";

  if (assignee.memberId) {
    targetMemberId = toObjectId(assignee.memberId, "member");
    const m = await members.findOne({ _id: targetMemberId, familyId: ctx.familyId });
    if (!m) throw notFound("family member");
    targetMemberName = m.name;
  } else if (assignee.memberName) {
    const m = await findMemberByName(ctx.familyId, assignee.memberName);
    if (!m) throw notFound(`family member "${assignee.memberName}"`);
    targetMemberId = m._id;
    targetMemberName = m.name;
  }

  await tasks.updateOne(
    { _id: oTaskId, familyId: ctx.familyId },
    { $set: { assigneeMemberId: targetMemberId, updatedAt: new Date() } }
  );

  await logActivity(
    ctx.familyId,
    { userId: ctx.userId, name: ctx.userName },
    "task_assigned",
    `${ctx.userName} assigned "${existing.title}" to ${targetMemberName}`,
    { type: "task", id: existing._id }
  );

  return (await tasks.findOne({ _id: oTaskId }))!;
}

export async function completeTask(ctx: AuthContext, taskId: string): Promise<TaskDoc> {
  const oTaskId = toObjectId(taskId, "task");
  const { tasks } = await collections();

  const existing = await tasks.findOne({ _id: oTaskId, familyId: ctx.familyId });
  if (!existing) throw notFound("task");

  await tasks.updateOne(
    { _id: oTaskId, familyId: ctx.familyId },
    {
      $set: {
        status: "done",
        completedAt: new Date(),
        completedBy: ctx.userId,
        updatedAt: new Date(),
      },
    }
  );

  await logActivity(
    ctx.familyId,
    { userId: ctx.userId, name: ctx.userName },
    "task_completed",
    `${ctx.userName} completed task: "${existing.title}"`,
    { type: "task", id: existing._id }
  );

  return (await tasks.findOne({ _id: oTaskId }))!;
}

export async function getTasks(
  familyId: ObjectId,
  status: "open" | "done" | "all" = "all"
): Promise<TaskDoc[]> {
  const { tasks } = await collections();
  const filter: any = { familyId };
  if (status !== "all") filter.status = status;

  return tasks.find(filter).sort({ status: 1, dueAt: 1, createdAt: -1 }).toArray();
}
