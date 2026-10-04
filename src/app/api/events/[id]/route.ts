import { NextRequest } from "next/server";
import { handleApi } from "@/server/api";
import { requireFamilyAuth } from "@/server/auth/guard";
import { updateFamilyEvent, deleteFamilyEvent, toEventDTO } from "@/server/services/events.service";

export async function PATCH(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  return handleApi(async () => {
    const ctx = await requireFamilyAuth();
    const { id } = await props.params;
    const body = await req.json().catch(() => ({}));

    const updated = await updateFamilyEvent(ctx, id, {
      title: body.title,
      startsAt: body.startsAt ? new Date(body.startsAt) : undefined,
      allDay: body.allDay,
      description: body.description,
      location: body.location,
    });

    return toEventDTO(updated, ctx.timezone);
  });
}

export async function DELETE(
  _req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  return handleApi(async () => {
    const ctx = await requireFamilyAuth();
    const { id } = await props.params;
    await deleteFamilyEvent(ctx, id);
    return { success: true };
  });
}
