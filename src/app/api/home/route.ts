import { handleApi } from "@/server/api";
import { requireFamilyAuth } from "@/server/auth/guard";
import { getTodaySchedule, getUpcomingEvents, toEventDTO } from "@/server/services/events.service";
import { getTasks, toTaskDTO } from "@/server/services/tasks.service";
import { getFamilyUpdates, toUpdateDTO } from "@/server/services/updates.service";
import { getFamilyReminders, toReminderDTO } from "@/server/services/reminders.service";
import { greetingFor } from "@/lib/time";
import type { HomeDTO } from "@/lib/types";

export async function GET() {
  return handleApi(async (): Promise<HomeDTO> => {
    const ctx = await requireFamilyAuth();
    const now = new Date();

    const [todayEventsDocs, upcomingEventsDocs, tasksDocs, updatesDocs, remindersDocs] = await Promise.all([
      getTodaySchedule(ctx.familyId, ctx.timezone, now),
      getUpcomingEvents(ctx.familyId, 5, now),
      getTasks(ctx.familyId, "all"),
      getFamilyUpdates(ctx.familyId, 5),
      getFamilyReminders(ctx.familyId),
    ]);

    const todayEvents = todayEventsDocs.map((e) => toEventDTO(e, ctx.timezone));
    const upcomingEvents = upcomingEventsDocs
      .filter((e) => !todayEventsDocs.some((te) => te._id.equals(e._id)))
      .map((e) => toEventDTO(e, ctx.timezone));

    const taskDTOs = await Promise.all(tasksDocs.map((t) => toTaskDTO(t, ctx.timezone)));
    const openTasks = taskDTOs.filter((t) => t.status === "open");
    const tasksDueToday = openTasks.filter((t) => t.dueLabel === "Today");

    const updates = updatesDocs.map(toUpdateDTO);
    const scheduledReminders = remindersDocs
      .filter((r) => r.status === "scheduled")
      .map((r) => toReminderDTO(r, ctx.timezone));
    const recentlyDelivered = remindersDocs
      .filter((r) => r.status === "delivered")
      .slice(0, 3)
      .map((r) => toReminderDTO(r, ctx.timezone));

    const todayLabel = now.toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
      timeZone: ctx.timezone,
    });

    return {
      greeting: greetingFor(now, ctx.timezone),
      userName: ctx.userName,
      familyName: ctx.familyName,
      timezone: ctx.timezone,
      todayLabel,
      today: todayEvents,
      tasksDueToday,
      openTasks,
      upcoming: upcomingEvents,
      updates,
      reminders: scheduledReminders,
      recentlyDelivered,
    };
  });
}
