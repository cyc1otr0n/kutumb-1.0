import { ObjectId } from "mongodb";
import { collections } from "../db/client";
import type { EventDoc } from "../db/types";
import { invalid, notFound } from "../errors";
import type { AuthContext } from "../context";
import { toObjectId } from "../context";
import { logActivity } from "./family.service";
import { dateKeyInTz, dayRangeUtc, formatDateTime, formatTime, relativeDayLabel } from "@/lib/time";
import type { EventDTO } from "@/lib/types";

export function toEventDTO(doc: EventDoc, tz: string): EventDTO {
  return {
    id: doc._id.toHexString(),
    title: doc.title,
    startsAt: doc.startsAt.toISOString(),
    allDay: doc.allDay,
    description: doc.description,
    location: doc.location,
    dayLabel: relativeDayLabel(doc.startsAt, tz),
    timeLabel: doc.allDay ? null : formatTime(doc.startsAt, tz),
    dateKey: doc.startsAt.toISOString().slice(0, 10),
  };
}

export async function createFamilyEvent(
  ctx: AuthContext,
  data: {
    title: string;
    startsAt: Date;
    allDay?: boolean;
    description?: string;
    location?: string;
  }
): Promise<EventDoc> {
  if (!data.title?.trim()) throw invalid("Event title is required");
  if (!data.startsAt || isNaN(data.startsAt.getTime())) throw invalid("Valid startsAt is required");

  const { events } = await collections();
  const doc: EventDoc = {
    _id: new ObjectId(),
    familyId: ctx.familyId,
    title: data.title.trim(),
    description: data.description?.trim() || null,
    location: data.location?.trim() || null,
    startsAt: data.startsAt,
    allDay: !!data.allDay,
    createdBy: ctx.userId,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  await events.insertOne(doc);

  const whenStr = formatDateTime(doc.startsAt, ctx.timezone, { allDay: doc.allDay });
  await logActivity(
    ctx.familyId,
    { userId: ctx.userId, name: ctx.userName },
    "event_created",
    `${ctx.userName} added event: "${doc.title}" for ${whenStr}`,
    { type: "event", id: doc._id }
  );

  return doc;
}

export async function updateFamilyEvent(
  ctx: AuthContext,
  eventId: string,
  data: {
    title?: string;
    startsAt?: Date;
    allDay?: boolean;
    description?: string;
    location?: string;
  }
): Promise<EventDoc> {
  const oId = toObjectId(eventId, "event");
  const { events } = await collections();

  const existing = await events.findOne({ _id: oId, familyId: ctx.familyId, deletedAt: null });
  if (!existing) throw notFound("event");

  const updates: Partial<EventDoc> = { updatedAt: new Date() };
  if (data.title !== undefined) {
    if (!data.title.trim()) throw invalid("Title cannot be empty");
    updates.title = data.title.trim();
  }
  if (data.startsAt !== undefined) {
    if (isNaN(data.startsAt.getTime())) throw invalid("Invalid startsAt");
    updates.startsAt = data.startsAt;
  }
  if (data.allDay !== undefined) updates.allDay = !!data.allDay;
  if (data.description !== undefined) updates.description = data.description?.trim() || null;
  if (data.location !== undefined) updates.location = data.location?.trim() || null;

  await events.updateOne({ _id: oId, familyId: ctx.familyId }, { $set: updates });
  const updated = (await events.findOne({ _id: oId }))!;

  await logActivity(
    ctx.familyId,
    { userId: ctx.userId, name: ctx.userName },
    "event_updated",
    `${ctx.userName} updated event: "${updated.title}"`,
    { type: "event", id: updated._id }
  );

  return updated;
}

export async function deleteFamilyEvent(ctx: AuthContext, eventId: string): Promise<void> {
  const oId = toObjectId(eventId, "event");
  const { events } = await collections();

  const existing = await events.findOne({ _id: oId, familyId: ctx.familyId, deletedAt: null });
  if (!existing) throw notFound("event");

  await events.updateOne(
    { _id: oId, familyId: ctx.familyId },
    { $set: { deletedAt: new Date(), updatedAt: new Date() } }
  );

  await logActivity(
    ctx.familyId,
    { userId: ctx.userId, name: ctx.userName },
    "event_deleted",
    `${ctx.userName} removed event: "${existing.title}"`,
    { type: "event", id: existing._id }
  );
}

export async function getTodaySchedule(familyId: ObjectId, tz: string, refDate = new Date()): Promise<EventDoc[]> {
  return getEventsForDateRange(familyId, tz, dateKeyInTz(refDate, tz), 1);
}

/** Events for a single local day, e.g. getScheduleForDateKey(fid, tz, "2026-10-05"). */
export async function getScheduleForDateKey(familyId: ObjectId, tz: string, dateKey: string): Promise<EventDoc[]> {
  return getEventsForDateRange(familyId, tz, dateKey, 1);
}

/** Events covering `days` local days starting at `startKey` (YYYY-MM-DD in family tz). */
export async function getEventsForDateRange(
  familyId: ObjectId,
  tz: string,
  startKey: string,
  days = 1
): Promise<EventDoc[]> {
  const { start, end } = dayRangeUtc(startKey, tz, Math.max(1, days));
  const { events } = await collections();

  return events
    .find({
      familyId,
      deletedAt: null,
      startsAt: { $gte: start, $lt: end },
    })
    .sort({ startsAt: 1 })
    .toArray();
}

export async function getUpcomingEvents(familyId: ObjectId, limit = 10, fromDate = new Date()): Promise<EventDoc[]> {
  const { events } = await collections();
  return events
    .find({
      familyId,
      deletedAt: null,
      startsAt: { $gte: fromDate },
    })
    .sort({ startsAt: 1 })
    .limit(limit)
    .toArray();
}

export async function getAllUpcomingOrRecentEvents(familyId: ObjectId, daysBack = 1, daysForward = 30): Promise<EventDoc[]> {
  const { events } = await collections();
  const past = new Date(Date.now() - daysBack * 86400000);
  const future = new Date(Date.now() + daysForward * 86400000);

  return events
    .find({
      familyId,
      deletedAt: null,
      startsAt: { $gte: past, $lte: future },
    })
    .sort({ startsAt: 1 })
    .toArray();
}
