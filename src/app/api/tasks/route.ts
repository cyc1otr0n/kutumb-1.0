import { NextRequest } from "next/server";
import { handleApi } from "@/server/api";
import { requireFamilyAuth } from "@/server/auth/guard";
import { createTask, getTasks, toTaskDTO } from "@/server/services/tasks.service";
import { invalid } from "@/server/errors";

export async function GET(req: NextRequest) {
  return handleApi(async () => {
    const ctx = await requireFamilyAuth();
    const url = new URL(req.url);
    const statusParam = (url.searchParams.get("status") || "all") as "open" | "done" | "all";

    const tasks = await getTasks(ctx.familyId, statusParam);
    return Promise.all(tasks.map((t) => toTaskDTO(t, ctx.timezone)));
  });
}

export async function POST(req: NextRequest) {
  return handleApi(async () => {
    const ctx = await requireFamilyAuth();
    const body = await req.json().catch(() => ({}));
    if (!body.title) throw invalid("Task title is required");

    const task = await createTask(ctx, {
      title: body.title,
      notes: body.notes,
      dueAt: body.dueAt ? new Date(body.dueAt) : null,
      assigneeMemberId: body.assigneeMemberId,
      assigneeName: body.assigneeName,
      relatedEventId: body.relatedEventId,
    });

    return toTaskDTO(task, ctx.timezone);
  });
}
