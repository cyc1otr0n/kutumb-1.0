import { NextRequest } from "next/server";
import { handleApi } from "@/server/api";
import { requireFamilyAuth } from "@/server/auth/guard";
import { createFamilyEvent, getAllUpcomingOrRecentEvents, toEventDTO } from "@/server/services/events.service";
import { invalid } from "@/server/errors";

export async function GET() {
  return handleApi(async () => {
    const ctx = await requireFamilyAuth();
    const events = await getAllUpcomingOrRecentEvents(ctx.familyId);
    return events.map((e) => toEventDTO(e, ctx.timezone));
  });
}

export async function POST(req: NextRequest) {
  return handleApi(async () => {
    const ctx = await requireFamilyAuth();
    const body = await req.json().catch(() => ({}));
    if (!body.title) throw invalid("Event title is required");
    if (!body.startsAt) throw invalid("Event start date/time is required");

    const event = await createFamilyEvent(ctx, {
      title: body.title,
      startsAt: new Date(body.startsAt),
      allDay: !!body.allDay,
      description: body.description,
      location: body.location,
    });

    return toEventDTO(event, ctx.timezone);
  });
}
