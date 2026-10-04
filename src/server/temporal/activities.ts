import { ObjectId } from "mongodb";
import { collections } from "../db/client";
import { logActivity } from "../services/family.service";

export async function deliverReminderActivity(input: {
  reminderId: string;
  familyId: string;
}): Promise<void> {
  const oReminderId = new ObjectId(input.reminderId);
  const oFamilyId = new ObjectId(input.familyId);

  const { reminders, updates } = await collections();

  const reminder = await reminders.findOne({ _id: oReminderId, familyId: oFamilyId });
  if (!reminder) {
    console.warn(`[Temporal Activity] Reminder ${input.reminderId} not found`);
    return;
  }

  if (reminder.status === "cancelled") {
    console.log(`[Temporal Activity] Reminder ${input.reminderId} was cancelled, skipping delivery`);
    return;
  }

  // Update status to delivered
  await reminders.updateOne(
    { _id: oReminderId },
    {
      $set: {
        status: "delivered",
        deliveredAt: new Date(),
        updatedAt: new Date(),
      },
    }
  );

  // Add family update so all members see the delivered reminder
  await updates.insertOne({
    _id: new ObjectId(),
    familyId: oFamilyId,
    authorUserId: null,
    authorName: "Kutumb Reminder",
    content: `🔔 Reminder: ${reminder.message}`,
    source: "reminder",
    createdAt: new Date(),
  });

  // Log to timeline
  await logActivity(
    oFamilyId,
    { userId: null, name: "Kutumb" },
    "reminder_delivered",
    `Delivered reminder: "${reminder.message}"`,
    { type: "reminder", id: oReminderId }
  );
}
