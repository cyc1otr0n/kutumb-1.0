import { NextRequest } from "next/server";
import { handleApi } from "@/server/api";
import { requireFamilyAuth } from "@/server/auth/guard";
import { assignTask, completeTask, toTaskDTO } from "@/server/services/tasks.service";
import { collections } from "@/server/db/client";
import { toObjectId } from "@/server/context";
import { notFound } from "@/server/errors";

export async function PATCH(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  return handleApi(async () => {
    const ctx = await requireFamilyAuth();
    const { id } = await props.params;
    const body = await req.json().catch(() => ({}));

    if (body.action === "complete") {
      const task = await completeTask(ctx, id);
      return toTaskDTO(task, ctx.timezone);
    }

    if (body.action === "assign") {
      const task = await assignTask(ctx, id, {
        memberId: body.memberId,
        memberName: body.memberName,
      });
      return toTaskDTO(task, ctx.timezone);
    }

    if (body.action === "reopen") {
      const oId = toObjectId(id, "task");
      const { tasks } = await collections();
      await tasks.updateOne(
        { _id: oId, familyId: ctx.familyId },
        { $set: { status: "open", completedAt: null, completedBy: null, updatedAt: new Date() } }
      );
      const updated = await tasks.findOne({ _id: oId });
      if (!updated) throw notFound("task");
      return toTaskDTO(updated, ctx.timezone);
    }

    const oId = toObjectId(id, "task");
    const { tasks } = await collections();
    const updates: any = { updatedAt: new Date() };
    if (body.title) updates.title = body.title;
    if (body.notes !== undefined) updates.notes = body.notes;
    if (body.dueAt !== undefined) updates.dueAt = body.dueAt ? new Date(body.dueAt) : null;

    await tasks.updateOne({ _id: oId, familyId: ctx.familyId }, { $set: updates });
    const updated = await tasks.findOne({ _id: oId });
    if (!updated) throw notFound("task");
    return toTaskDTO(updated, ctx.timezone);
  });
}
