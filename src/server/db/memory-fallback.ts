import { ObjectId } from "mongodb";
import type { Collections } from "./client";

class InMemoryCollection<T extends { _id?: any }> {
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
      result = result.filter((item: any) =>
        item.familyId?.equals?.(filter.familyId) || item.familyId === filter.familyId || item.familyId?.toString() === filter.familyId?.toString()
      );
    }
    if (filter.status && filter.status !== "all") {
      result = result.filter((item: any) => item.status === filter.status);
    }
    if (filter.deletedAt !== undefined) {
      result = result.filter((item: any) => item.deletedAt === filter.deletedAt);
    }
    if (filter._id) {
      if (filter._id.$in) {
        result = result.filter((item: any) =>
          filter._id.$in.some((id: any) => id.equals?.(item._id) || id.toString() === item._id?.toString())
        );
      } else {
        result = result.filter((item: any) =>
          filter._id.equals?.(item._id) || filter._id.toString() === item._id?.toString()
        );
      }
    }
    if (filter.email) {
      result = result.filter((item: any) => item.email?.toLowerCase() === filter.email?.toLowerCase());
    }
    if (filter.inviteCode) {
      result = result.filter((item: any) => item.inviteCode?.toUpperCase() === filter.inviteCode?.toUpperCase());
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
    const idx = this.items.findIndex((item: any) =>
      item._id?.equals?.(filter._id) || item._id?.toString() === filter._id?.toString()
    );
    if (idx !== -1) {
      this.items.splice(idx, 1);
      return { deletedCount: 1 };
    }
    return { deletedCount: 0 };
  }

  async createIndex() {
    return "ok";
  }
}

// Global cache for dev hot reloads so data persists across Next.js page reloads
const globalForMem = globalThis as unknown as { __kutumbMemoryCollections?: Collections };

export function getInMemoryCollections(): Collections {
  if (globalForMem.__kutumbMemoryCollections) {
    return globalForMem.__kutumbMemoryCollections;
  }

  const collections = {
    users: new InMemoryCollection<any>(),
    families: new InMemoryCollection<any>(),
    members: new InMemoryCollection<any>(),
    events: new InMemoryCollection<any>(),
    tasks: new InMemoryCollection<any>(),
    reminders: new InMemoryCollection<any>(),
    updates: new InMemoryCollection<any>(),
    memories: new InMemoryCollection<any>(),
    digests: new InMemoryCollection<any>(),
    voiceUpdates: new InMemoryCollection<any>(),
    activity: new InMemoryCollection<any>(),
    pendingActions: new InMemoryCollection<any>(),
  } as unknown as Collections;

  globalForMem.__kutumbMemoryCollections = collections;
  return collections;
}
