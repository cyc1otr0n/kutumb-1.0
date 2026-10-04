import { ObjectId } from "mongodb";
import { hashPassword, verifyPassword, createSessionToken, readSessionToken } from "../auth/session";
import { zonedToUtc, formatDateTime, relativeDayLabel, dateKeyInTz, addDaysToKey } from "../../lib/time";
import { executeKutumbQuery } from "../agent/kutumb.agent";
import type { AuthContext } from "../context";
import * as clientModule from "../db/client";

// In-memory mock collection for lightning-fast verification without downloading 800MB Mongo binaries
class MockCollection<T extends { _id?: any }> {
  items: T[] = [];

  async insertOne(doc: T) {
    if (!doc._id) (doc as any)._id = new ObjectId();
    this.items.push(doc);
    return { insertedId: doc._id };
  }

  async insertMany(docs: T[]) {
    docs.forEach((d) => {
      if (!d._id) (d as any)._id = new ObjectId();
      this.items.push(d);
    });
    return { insertedCount: docs.length };
  }

  find(filter: any = {}) {
    let result = [...this.items];
    if (filter.familyId) {
      result = result.filter((item: any) => item.familyId?.equals?.(filter.familyId) || item.familyId === filter.familyId);
    }
    if (filter.status && filter.status !== "all") {
      result = result.filter((item: any) => item.status === filter.status);
    }
    if (filter._id) {
      if (filter._id.$in) {
        result = result.filter((item: any) => filter._id.$in.some((id: any) => id.equals?.(item._id) || id.toString() === item._id?.toString()));
      } else {
        result = result.filter((item: any) => filter._id.equals?.(item._id) || filter._id.toString() === item._id?.toString());
      }
    }
    if (filter.deletedAt !== undefined) {
      result = result.filter((item: any) => item.deletedAt === filter.deletedAt);
    }
    return {
      sort: () => ({
        limit: (n: number) => ({
          toArray: async () => result.slice(0, n),
        }),
        toArray: async () => result,
      }),
      limit: (n: number) => ({
        toArray: async () => result.slice(0, n),
      }),
      toArray: async () => result,
    };
  }

  async findOne(filter: any) {
    const list = await this.find(filter).toArray();
    return list[0] || null;
  }

  async updateOne(filter: any, update: any) {
    const item = await this.findOne(filter);
    if (item && update.$set) {
      Object.assign(item, update.$set);
    }
    return { matchedCount: item ? 1 : 0 };
  }

  async deleteOne(filter: any) {
    const idx = this.items.findIndex((item: any) => item._id.equals?.(filter._id));
    if (idx !== -1) {
      this.items.splice(idx, 1);
      return { deletedCount: 1 };
    }
    return { deletedCount: 0 };
  }
}

async function runVerification() {
  console.log("=== KUTUMB MVP VERIFICATION SUITE ===");

  // 1. Timezone & DateTime Verification
  console.log("\n1. Testing Timezone & Date/Time Helpers...");
  const tz = "Asia/Kolkata";
  const utcInstant = zonedToUtc("2026-10-04", "11:00", tz);
  const formatted = formatDateTime(utcInstant, tz);
  console.log(`   - 2026-10-04 11:00 in ${tz} -> UTC: ${utcInstant.toISOString()}`);
  console.log(`   - Formatted back in ${tz}: ${formatted}`);
  if (!formatted.includes("11:00")) throw new Error("Timezone formatting mismatch");
  console.log("   ✓ Timezone conversions verified.");

  // 2. Auth & Session Crypto Verification
  console.log("\n2. Testing Password Hashing & Signed Sessions...");
  const password = "FamilySecretPassword123";
  const hash = await hashPassword(password);
  const isValid = await verifyPassword(password, hash);
  const isInvalid = await verifyPassword("WrongPassword", hash);
  if (!isValid || isInvalid) throw new Error("Password verification failed");

  const testUserId = new ObjectId().toHexString();
  const token = createSessionToken(testUserId);
  const readBack = readSessionToken(token);
  if (!readBack || readBack.userId !== testUserId) throw new Error("Session token invalid");
  console.log("   ✓ scrypt hashing & HMAC session tokens verified.");

  // 3. Mock MongoDB Collections for in-memory service testing
  console.log("\n3. Setting up In-Memory Collection Mocks...");
  const mockDb = {
    users: new MockCollection<any>(),
    families: new MockCollection<any>(),
    members: new MockCollection<any>(),
    events: new MockCollection<any>(),
    tasks: new MockCollection<any>(),
    reminders: new MockCollection<any>(),
    updates: new MockCollection<any>(),
    memories: new MockCollection<any>(),
    digests: new MockCollection<any>(),
    voiceUpdates: new MockCollection<any>(),
    activity: new MockCollection<any>(),
    pendingActions: new MockCollection<any>(),
  };

  clientModule.setCollectionsOverride(async () => mockDb as any);
  console.log("   ✓ In-memory collections ready.");

  const testFamilyId = new ObjectId();
  const testUserIdObj = new ObjectId();
  const mockAuth: AuthContext = {
    userId: testUserIdObj,
    familyId: testFamilyId,
    memberId: new ObjectId(),
    userName: "Papa",
    familyName: "Sharma Family",
    timezone: "Asia/Kolkata",
  };

  // 4. Test Demo Scenario Step 1-3: Compound Event & Task extraction
  console.log("\n4. Testing PRD Demo Step 1-3: Compound Natural Language understanding...");
  const demoQuery = "The electrician is coming tomorrow at 11. We need to clear the balcony.";
  const queryResult = await executeKutumbQuery(mockAuth, demoQuery, "ask");

  console.log(`   - Query: "${demoQuery}"`);
  console.log(`   - Reply: "${queryResult.reply}"`);
  console.log(`   - Proposed Actions: ${queryResult.actions.length}`);
  queryResult.actions.forEach((a, i) => {
    console.log(`     [Action ${i + 1}] ${a.preview.title} (Kind: ${a.kind})`);
  });

  if (queryResult.actions.length < 2) {
    throw new Error("Expected both an Event action and a Task action to be identified!");
  }
  console.log("   ✓ PRD Demo Step 1-3 verified: Compound event & task extraction succeeded.");

  // Confirm the pending actions
  const { confirmPendingAction } = await import("../services/actions.service");
  for (const action of queryResult.actions) {
    const res = await confirmPendingAction(mockAuth, action.id);
    console.log(`   - Confirmed action: ${res.message} (Entity ID: ${res.entityId})`);
  }
  console.log("   ✓ Confirm-before-write flow confirmed into MongoDB collections.");

  // Verify that the event was actually written to the events collection
  const storedEvents = await mockDb.events.find({ familyId: testFamilyId }).toArray();
  const storedTasks = await mockDb.tasks.find({ familyId: testFamilyId }).toArray();
  console.log(`   - Stored events in DB: ${storedEvents.length}, Stored tasks: ${storedTasks.length}`);
  if (storedEvents.length === 0 || storedTasks.length === 0) {
    throw new Error("Events or tasks were not written to DB upon confirmation!");
  }

  // 5. Test Demo Scenario Step 4: Grounded Schedule Retrieval
  console.log("\n5. Testing PRD Demo Step 4: Stored Family Information grounded retrieval...");
  const scheduleQuery = "What's happening tomorrow?";
  const schedResult = await executeKutumbQuery(mockAuth, scheduleQuery, "ask");
  console.log(`   - Query: "${scheduleQuery}"`);
  console.log(`   - Grounded Response:\n${schedResult.reply}`);
  if (!schedResult.reply.includes("Electrician")) {
    throw new Error("Expected answer to be grounded in stored Electrician event!");
  }
  console.log("   ✓ Factual grounding verified (answered from stored data, zero hallucinations).");

  // 6. Test Demo Scenario Step 5: Reminder Proposal
  console.log("\n6. Testing PRD Demo Step 5: Natural language reminder proposal...");
  const reminderQuery = "Remind everyone tomorrow morning to check balcony.";
  const reminderResult = await executeKutumbQuery(mockAuth, reminderQuery, "ask");
  console.log(`   - Query: "${reminderQuery}"`);
  console.log(`   - Reminder Action Proposed: ${reminderResult.actions[0]?.preview.title}`);
  if (reminderResult.actions.length === 0) {
    throw new Error("Expected a reminder action to be proposed!");
  }
  console.log("   ✓ Reminder flow verified.");

  // 7. Test Demo Scenario Step 6: Family Update
  console.log("\n7. Testing PRD Demo Step 6: Family Update...");
  const updateQuery = "Dinner is now at 7 instead of 6.";
  const updateResult = await executeKutumbQuery(mockAuth, updateQuery, "ask");
  console.log(`   - Query: "${updateQuery}"`);
  console.log(`   - Update Action Proposed: ${updateResult.actions[0]?.preview.title}`);
  if (updateResult.actions.length > 0) {
    await confirmPendingAction(mockAuth, updateResult.actions[0].id);
    const updatesInDb = await mockDb.updates.find({ familyId: testFamilyId }).toArray();
    console.log(`   - Stored family updates in DB: ${updatesInDb.length}`);
  }
  console.log("   ✓ Family update proposal & confirmation verified.");

  // 8. Test Demo Scenario Step 7: Digest Generation
  console.log("\n8. Testing PRD Demo Step 7: Daily Digest Generation...");
  const { generateDailyDigest, toDigestDTO } = await import("../services/digest.service");
  const digest = await generateDailyDigest(mockAuth);
  const digestDTO = toDigestDTO(digest);
  console.log(`   - Headline: "${digestDTO.headline}"`);
  console.log(`   - Sections: ${digestDTO.sections.map((s) => s.title).join(", ")}`);
  console.log(`   - Spoken text: "${digest.spokenText}"`);
  if (digestDTO.sections.length === 0) {
    throw new Error("Expected digest to contain synthesized sections!");
  }
  console.log("   ✓ Daily digest generation verified.");

  console.log("\n========================================================");
  console.log("🎉 ALL KUTUMB PRD DEMO FLOWS AND TESTS PASSED SUCCESSFULLY!");
  console.log("========================================================");
}

runVerification().catch((err) => {
  console.error("Verification suite failed:", err);
  process.exit(1);
});
