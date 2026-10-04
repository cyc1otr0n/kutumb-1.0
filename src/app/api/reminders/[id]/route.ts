import { NextRequest } from "next/server";
import { handleApi } from "@/server/api";
import { requireFamilyAuth } from "@/server/auth/guard";
import { cancelReminder, toReminderDTO } from "@/server/services/reminders.service";

export async function DELETE(
  _req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  return handleApi(async () => {
    const ctx = await requireFamilyAuth();
    const { id } = await props.params;
    const reminder = await cancelReminder(ctx, id);
    return toReminderDTO(reminder, ctx.timezone);
  });
}
