import { NextRequest } from "next/server";
import { handleApi } from "@/server/api";
import { requireFamilyAuth } from "@/server/auth/guard";
import { createReminder, getFamilyReminders, toReminderDTO } from "@/server/services/reminders.service";
import { invalid } from "@/server/errors";

export async function GET() {
  return handleApi(async () => {
    const ctx = await requireFamilyAuth();
    const reminders = await getFamilyReminders(ctx.familyId);
    return reminders.map((r) => toReminderDTO(r, ctx.timezone));
  });
}

export async function POST(req: NextRequest) {
  return handleApi(async () => {
    const ctx = await requireFamilyAuth();
    const body = await req.json().catch(() => ({}));
    if (!body.message) throw invalid("Reminder message is required");
    if (!body.fireAt) throw invalid("Reminder fireAt is required");

    const reminder = await createReminder(ctx, {
      message: body.message,
      fireAt: new Date(body.fireAt),
      audienceMemberIds: body.audienceMemberIds,
      relatedEventId: body.relatedEventId,
    });

    return toReminderDTO(reminder, ctx.timezone);
  });
}
