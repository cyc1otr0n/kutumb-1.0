try {
  // @ts-ignore
  process.loadEnvFile?.(".env.local");
  // @ts-ignore
  process.loadEnvFile?.(".env");
} catch {
  // Ignore if files do not exist
}

import { ObjectId } from "mongodb";
import { collections } from "./db/client";
import { hashPassword } from "./auth/session";
import { zonedToUtc, dateKeyInTz, addDaysToKey } from "../lib/time";
import { generateDailyDigest } from "./services/digest.service";
import type { AuthContext } from "./context";

async function seed() {
  console.log("🌱 Seeding Kutumb with rich family demo data...\n");

  const { users, families, members, events, tasks, reminders, updates, memories, digests, activity, pendingActions } = await collections();

  // 1. Create Default Family
  const timezone = "Asia/Kolkata";
  const now = new Date();
  const todayKey = dateKeyInTz(now, timezone);
  const tomorrowKey = addDaysToKey(todayKey, 1);
  const in3DaysKey = addDaysToKey(todayKey, 3);
  const sundayKey = addDaysToKey(todayKey, 2);

  const familyId = new ObjectId();
  const papaUserId = new ObjectId();
  const papaMemberId = new ObjectId();
  const momMemberId = new ObjectId();
  const aaravMemberId = new ObjectId();
  const dadiMemberId = new ObjectId();

  console.log("1. Creating Family: 'The Sharma Family'...");
  await families.deleteMany({}); // clean previous demo seed
  await families.insertOne({
    _id: familyId,
    name: "The Sharma Family",
    timezone,
    inviteCode: "KUTUMB-2026",
    createdBy: papaUserId,
    createdAt: now,
  });

  // 2. Create Users & Family Members
  console.log("2. Creating Family Members & Users...");
  await users.deleteMany({});
  await members.deleteMany({});

  const passwordHash = await hashPassword("password123");

  // Papa (Admin user account)
  await users.insertOne({
    _id: papaUserId,
    email: "papa@kutumb.app",
    name: "Papa",
    passwordHash,
    familyId,
    memberId: papaMemberId,
    createdAt: now,
  });

  // Secondary user account: n@gmail.com (so the user's previous login also works!)
  await users.insertOne({
    _id: new ObjectId(),
    email: "n@gmail.com",
    name: "Nishad",
    passwordHash,
    familyId,
    memberId: papaMemberId,
    createdAt: now,
  });

  await members.insertMany([
    {
      _id: papaMemberId,
      familyId,
      name: "Papa",
      relation: "Father",
      birthday: "1975-08-12",
      userId: papaUserId,
      color: "#c2593f", // Terracotta
      createdAt: now,
    },
    {
      _id: momMemberId,
      familyId,
      name: "Mom",
      relation: "Mother",
      birthday: "1978-04-22",
      userId: null,
      color: "#059669", // Emerald
      createdAt: now,
    },
    {
      _id: aaravMemberId,
      familyId,
      name: "Aarav",
      relation: "Son",
      birthday: "2005-10-18",
      userId: null,
      color: "#4f46e5", // Indigo
      createdAt: now,
    },
    {
      _id: dadiMemberId,
      familyId,
      name: "Dadi",
      relation: "Grandmother",
      birthday: "1950-12-05",
      userId: null,
      color: "#d97706", // Amber
      createdAt: now,
    },
  ]);

  // 3. Create Events
  console.log("3. Creating Family Events...");
  await events.deleteMany({});
  const electricianStartsAt = zonedToUtc(tomorrowKey, "11:00", timezone);
  const groceryPickupStartsAt = zonedToUtc(todayKey, "17:00", timezone);
  const dadiDoctorStartsAt = zonedToUtc(in3DaysKey, "10:30", timezone);
  const dinnerStartsAt = zonedToUtc(sundayKey, "19:00", timezone);

  const electricianEventId = new ObjectId();

  await events.insertMany([
    {
      _id: electricianEventId,
      familyId,
      title: "Electrician visit",
      description: "Inspection of main switchboard and balcony wiring",
      location: "Home",
      startsAt: electricianStartsAt,
      allDay: false,
      createdBy: papaUserId,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    },
    {
      _id: new ObjectId(),
      familyId,
      title: "Grocery pickup",
      description: "Pick up week's vegetables and dry goods",
      location: "Supermarket Downtown",
      startsAt: groceryPickupStartsAt,
      allDay: false,
      createdBy: papaUserId,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    },
    {
      _id: new ObjectId(),
      familyId,
      title: "Dadi's Eye Checkup",
      description: "Routine vision test with Dr. Verma",
      location: "City Eye Clinic",
      startsAt: dadiDoctorStartsAt,
      allDay: false,
      createdBy: papaUserId,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    },
    {
      _id: new ObjectId(),
      familyId,
      title: "Family Dinner",
      description: "Celebrating Aarav's semester exams completion",
      location: "Grand Heritage Restaurant",
      startsAt: dinnerStartsAt,
      allDay: false,
      createdBy: papaUserId,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    },
  ]);

  // 4. Create Tasks
  console.log("4. Creating Family Tasks...");
  await tasks.deleteMany({});
  await tasks.insertMany([
    {
      _id: new ObjectId(),
      familyId,
      title: "Clear the balcony",
      notes: "Need space for the electrician to reach the outdoor wiring",
      dueAt: zonedToUtc(tomorrowKey, "10:00", timezone),
      assigneeMemberId: aaravMemberId,
      relatedEventId: electricianEventId,
      status: "open",
      createdBy: papaUserId,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
      completedBy: null,
    },
    {
      _id: new ObjectId(),
      familyId,
      title: "Pick up the cake",
      notes: "Chocolate truffle cake from Baker's Delight",
      dueAt: zonedToUtc(in3DaysKey, "16:00", timezone),
      assigneeMemberId: papaMemberId,
      relatedEventId: null,
      status: "open",
      createdBy: papaUserId,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
      completedBy: null,
    },
    {
      _id: new ObjectId(),
      familyId,
      title: "Buy groceries list",
      notes: "Milk, brown bread, olive oil, and Dadi's herbal tea",
      dueAt: groceryPickupStartsAt,
      assigneeMemberId: null,
      relatedEventId: null,
      status: "open",
      createdBy: papaUserId,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
      completedBy: null,
    },
    {
      _id: new ObjectId(),
      familyId,
      title: "Pay electricity bill",
      notes: "Paid online via UPI",
      dueAt: now,
      assigneeMemberId: papaMemberId,
      relatedEventId: null,
      status: "done",
      createdBy: papaUserId,
      createdAt: new Date(Date.now() - 86400000),
      updatedAt: now,
      completedAt: now,
      completedBy: papaUserId,
    },
  ]);

  // 5. Create Family Updates
  console.log("5. Creating Family Announcements & Updates...");
  await updates.deleteMany({});
  await updates.insertMany([
    {
      _id: new ObjectId(),
      familyId,
      authorUserId: papaUserId,
      authorName: "Papa",
      content: "The electrician is confirmed for tomorrow at 11 AM. Aarav, please make sure the balcony is cleared beforehand.",
      source: "voice",
      createdAt: new Date(Date.now() - 3600000 * 3),
    },
    {
      _id: new ObjectId(),
      familyId,
      authorUserId: null,
      authorName: "Mom",
      content: "Dinner is now at 7:00 PM on Sunday instead of 6:00 PM so everyone has time to dress up!",
      source: "text",
      createdAt: new Date(Date.now() - 3600000 * 2),
    },
    {
      _id: new ObjectId(),
      familyId,
      authorUserId: null,
      authorName: "Aarav",
      content: "I'll clear the balcony first thing tomorrow morning before my morning college lecture.",
      source: "text",
      createdAt: new Date(Date.now() - 3600000),
    },
  ]);

  // 6. Create Explicit Family Memories
  console.log("6. Creating Explicit Family Memories...");
  await memories.deleteMany({});
  await memories.insertMany([
    {
      _id: new ObjectId(),
      familyId,
      createdBy: papaUserId,
      content: "Dad doesn't like spicy food and always prefers mild seasoning.",
      category: "preference",
      source: "manual",
      createdAt: new Date(Date.now() - 86400000 * 5),
      updatedAt: new Date(Date.now() - 86400000 * 5),
    },
    {
      _id: new ObjectId(),
      familyId,
      createdBy: papaUserId,
      content: "Mom prefers window seats on morning flights and herbal green tea.",
      category: "preference",
      source: "manual",
      createdAt: new Date(Date.now() - 86400000 * 4),
      updatedAt: new Date(Date.now() - 86400000 * 4),
    },
    {
      _id: new ObjectId(),
      familyId,
      createdBy: papaUserId,
      content: "Dadi takes her blood pressure medicine right after breakfast around 9:00 AM.",
      category: "household",
      source: "manual",
      createdAt: new Date(Date.now() - 86400000 * 3),
      updatedAt: new Date(Date.now() - 86400000 * 3),
    },
    {
      _id: new ObjectId(),
      familyId,
      createdBy: papaUserId,
      content: "Home Wi-Fi network is 'SharmaHome_5G'. Router restart button is in the study cabinet.",
      category: "household",
      source: "manual",
      createdAt: new Date(Date.now() - 86400000 * 2),
      updatedAt: new Date(Date.now() - 86400000 * 2),
    },
    {
      _id: new ObjectId(),
      familyId,
      createdBy: papaUserId,
      content: "Decided to take the family vacation to Udaipur during the winter holidays in late December.",
      category: "decision",
      source: "manual",
      createdAt: new Date(Date.now() - 86400000),
      updatedAt: new Date(Date.now() - 86400000),
    },
  ]);

  // 7. Create Reminders
  console.log("7. Creating Reminders...");
  await reminders.deleteMany({});
  await reminders.insertMany([
    {
      _id: new ObjectId(),
      familyId,
      message: "Check that the balcony is clear before the electrician arrives",
      fireAt: zonedToUtc(tomorrowKey, "09:30", timezone),
      audienceMemberIds: [],
      relatedEventId: electricianEventId,
      status: "scheduled",
      workflowId: "kutumb-reminder-seed-1",
      failureReason: null,
      createdBy: papaUserId,
      createdAt: now,
      updatedAt: now,
      deliveredAt: null,
      cancelledAt: null,
    },
    {
      _id: new ObjectId(),
      familyId,
      message: "Pack water bottle and sun hat for morning walk",
      fireAt: zonedToUtc(todayKey, "06:30", timezone),
      audienceMemberIds: [dadiMemberId],
      relatedEventId: null,
      status: "delivered",
      workflowId: "kutumb-reminder-seed-2",
      failureReason: null,
      createdBy: papaUserId,
      createdAt: new Date(Date.now() - 86400000),
      updatedAt: now,
      deliveredAt: new Date(Date.now() - 3600000 * 5),
      cancelledAt: null,
    },
  ]);

  // 8. Create Timeline Activity
  console.log("8. Creating Activity Timeline...");
  await activity.deleteMany({});
  await activity.insertMany([
    {
      _id: new ObjectId(),
      familyId,
      actorUserId: papaUserId,
      actorName: "Papa",
      type: "event_created",
      summary: "Papa scheduled 'Electrician visit' for tomorrow at 11:00 AM",
      entityType: "event",
      entityId: electricianEventId,
      createdAt: new Date(Date.now() - 3600000 * 4),
    },
    {
      _id: new ObjectId(),
      familyId,
      actorUserId: papaUserId,
      actorName: "Papa",
      type: "task_created",
      summary: "Papa added task 'Clear the balcony' and assigned it to Aarav",
      entityType: "task",
      entityId: null,
      createdAt: new Date(Date.now() - 3600000 * 3.8),
    },
    {
      _id: new ObjectId(),
      familyId,
      actorUserId: null,
      actorName: "Mom",
      type: "update_posted",
      summary: "Mom announced: Dinner moved to 7:00 PM on Sunday",
      entityType: "update",
      entityId: null,
      createdAt: new Date(Date.now() - 3600000 * 2),
    },
    {
      _id: new ObjectId(),
      familyId,
      actorUserId: papaUserId,
      actorName: "Papa",
      type: "reminder_scheduled",
      summary: "Papa scheduled reminder for tomorrow at 9:30 AM",
      entityType: "reminder",
      entityId: null,
      createdAt: new Date(Date.now() - 3600000),
    },
  ]);

  // Clean pending actions
  await pendingActions.deleteMany({});

  // 9. Generate Daily Digest
  console.log("9. Generating Daily Digest with Gemma...");
  await digests.deleteMany({});
  const mockAuth: AuthContext = {
    userId: papaUserId,
    familyId,
    memberId: papaMemberId,
    userName: "Papa",
    familyName: "The Sharma Family",
    timezone,
  };

  try {
    const digest = await generateDailyDigest(mockAuth);
    console.log(`   ✓ Digest generated: "${digest.headline}" (by ${digest.generatedBy})`);
  } catch (err) {
    console.warn("   Digest generation warning (non-fatal):", err);
  }

  console.log("\n========================================================");
  console.log("🎉 SEEDING COMPLETED SUCCESSFULLY!");
  console.log("========================================================");
  console.log("Family: 'The Sharma Family'");
  console.log("Invite Code: KUTUMB-2026");
  console.log("\nTest User Accounts:");
  console.log("  1) Email: papa@kutumb.app    | Password: password123");
  console.log("  2) Email: n@gmail.com        | Password: password123");
  console.log("========================================================\n");

  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
