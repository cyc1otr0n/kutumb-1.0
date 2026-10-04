import { MongoClient, type Db, type Collection, type Document } from "mongodb";
import { env } from "../env";
import { AppError, USER_MESSAGES } from "../errors";
import type {
  ActivityDoc,
  DailyDigestDoc,
  EventDoc,
  FamilyDoc,
  FamilyMemberDoc,
  FamilyUpdateDoc,
  MemoryDoc,
  PendingActionDoc,
  ReminderDoc,
  TaskDoc,
  UserDoc,
  VoiceUpdateDoc,
} from "./types";

/**
 * DatabaseService: the single MongoDB entry point for the web app and the Temporal worker.
 * The connection is cached on globalThis so Next.js dev hot-reloads don't leak connections.
 */

interface MongoCache {
  client: MongoClient | null;
  connecting: Promise<MongoClient> | null;
  indexesReady: Promise<void> | null;
}

const globalForMongo = globalThis as unknown as { __kutumbMongo?: MongoCache };
const cache: MongoCache = (globalForMongo.__kutumbMongo ??= { client: null, connecting: null, indexesReady: null });

async function connect(): Promise<MongoClient> {
  if (cache.client) return cache.client;
  if (!cache.connecting) {
    const uri = env.mongoUri();
    if (!uri) {
      throw new AppError("not_configured", USER_MESSAGES.db, { cause: new Error("MONGODB_URI is not set") });
    }
    const client = new MongoClient(uri, {
      appName: "kutumb",
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 8000,
    });
    cache.connecting = client
      .connect()
      .then((c) => {
        cache.client = c;
        return c;
      })
      .catch((err) => {
        cache.connecting = null;
        throw new AppError("database_unavailable", USER_MESSAGES.db, { cause: err });
      });
  }
  return cache.connecting;
}

export async function getDb(): Promise<Db> {
  const client = await connect();
  const db = client.db(env.mongoDbName());
  if (!cache.indexesReady) {
    cache.indexesReady = ensureIndexes(db).catch((err) => {
      cache.indexesReady = null;
      throw err;
    });
  }
  await cache.indexesReady;
  return db;
}

export async function closeDb(): Promise<void> {
  if (cache.client) await cache.client.close();
  cache.client = null;
  cache.connecting = null;
  cache.indexesReady = null;
}

function col<T extends Document>(db: Db, name: string): Collection<T> {
  return db.collection<T>(name);
}

let collectionsOverride: (() => Promise<Collections>) | null = null;

export function setCollectionsOverride(fn: (() => Promise<Collections>) | null) {
  collectionsOverride = fn;
}

export async function collections(): Promise<Collections> {
  if (collectionsOverride) return collectionsOverride();
  const db = await getDb();
  return {
    users: col<UserDoc>(db, "users"),
    families: col<FamilyDoc>(db, "families"),
    members: col<FamilyMemberDoc>(db, "family_members"),
    events: col<EventDoc>(db, "events"),
    tasks: col<TaskDoc>(db, "tasks"),
    reminders: col<ReminderDoc>(db, "reminders"),
    updates: col<FamilyUpdateDoc>(db, "family_updates"),
    memories: col<MemoryDoc>(db, "memories"),
    digests: col<DailyDigestDoc>(db, "daily_digests"),
    voiceUpdates: col<VoiceUpdateDoc>(db, "voice_updates"),
    activity: col<ActivityDoc>(db, "activity_timeline"),
    pendingActions: col<PendingActionDoc>(db, "pending_actions"),
  } as Collections;
}

export type Collections = {
  users: Collection<UserDoc>;
  families: Collection<FamilyDoc>;
  members: Collection<FamilyMemberDoc>;
  events: Collection<EventDoc>;
  tasks: Collection<TaskDoc>;
  reminders: Collection<ReminderDoc>;
  updates: Collection<FamilyUpdateDoc>;
  memories: Collection<MemoryDoc>;
  digests: Collection<DailyDigestDoc>;
  voiceUpdates: Collection<VoiceUpdateDoc>;
  activity: Collection<ActivityDoc>;
  pendingActions: Collection<PendingActionDoc>;
};

async function ensureIndexes(db: Db): Promise<void> {
  await Promise.all([
    db.collection("users").createIndex({ email: 1 }, { unique: true }),
    db.collection("families").createIndex({ inviteCode: 1 }, { unique: true }),
    db.collection("family_members").createIndex({ familyId: 1, name: 1 }),
    db.collection("events").createIndex({ familyId: 1, deletedAt: 1, startsAt: 1 }),
    db.collection("tasks").createIndex({ familyId: 1, status: 1, dueAt: 1 }),
    db.collection("reminders").createIndex({ familyId: 1, status: 1, fireAt: 1 }),
    db.collection("family_updates").createIndex({ familyId: 1, createdAt: -1 }),
    db.collection("memories").createIndex({ familyId: 1, createdAt: -1 }),
    db.collection("memories").createIndex({ content: "text" }, { name: "memories_text" }),
    db.collection("daily_digests").createIndex({ familyId: 1, period: 1, dateKey: 1, createdAt: -1 }),
    db.collection("voice_updates").createIndex({ familyId: 1, createdAt: -1 }),
    db.collection("activity_timeline").createIndex({ familyId: 1, createdAt: -1 }),
    db.collection("pending_actions").createIndex({ familyId: 1, status: 1 }),
    // Unconfirmed proposals expire on their own.
    db.collection("pending_actions").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
  ]);
}
