import { ObjectId } from "mongodb";
import { collections } from "../db/client";
import type { MemoryCategory, MemoryDoc } from "../db/types";
import { invalid, notFound } from "../errors";
import type { AuthContext } from "../context";
import { toObjectId } from "../context";
import { logActivity } from "./family.service";
import type { MemoryDTO } from "@/lib/types";

export function toMemoryDTO(doc: MemoryDoc): MemoryDTO {
  return {
    id: doc._id.toHexString(),
    content: doc.content,
    category: doc.category,
    source: doc.source,
    createdAt: doc.createdAt.toISOString(),
  };
}

export async function saveFamilyMemory(
  ctx: AuthContext,
  data: {
    content: string;
    category?: MemoryCategory;
    source?: "manual" | "assistant" | "voice";
  }
): Promise<MemoryDoc> {
  if (!data.content?.trim()) throw invalid("Memory content cannot be empty");

  const { memories } = await collections();
  const doc: MemoryDoc = {
    _id: new ObjectId(),
    familyId: ctx.familyId,
    createdBy: ctx.userId,
    content: data.content.trim(),
    category: data.category || "miscellaneous",
    source: data.source || "manual",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await memories.insertOne(doc);

  await logActivity(
    ctx.familyId,
    { userId: ctx.userId, name: ctx.userName },
    "memory_saved",
    `${ctx.userName} saved a memory: "${doc.content.length > 50 ? doc.content.slice(0, 47) + "..." : doc.content}"`,
    { type: "memory", id: doc._id }
  );

  return doc;
}

export async function getFamilyMemory(
  familyId: ObjectId,
  opts?: { query?: string; category?: string; limit?: number }
): Promise<MemoryDoc[]> {
  const { memories } = await collections();
  const filter: any = { familyId };

  if (opts?.category && opts.category !== "all") {
    filter.category = opts.category;
  }

  if (opts?.query?.trim()) {
    // Regex search; user text is escaped so "?" / "(" etc. are matched literally.
    const q = opts.query.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { content: { $regex: new RegExp(q, "i") } },
      { category: { $regex: new RegExp(q, "i") } },
    ];
  }

  return memories
    .find(filter)
    .sort({ createdAt: -1 })
    .limit(opts?.limit || 50)
    .toArray();
}

export async function deleteFamilyMemory(ctx: AuthContext, memoryId: string): Promise<void> {
  const oId = toObjectId(memoryId, "memory");
  const { memories } = await collections();

  const existing = await memories.findOne({ _id: oId, familyId: ctx.familyId });
  if (!existing) throw notFound("memory");

  await memories.deleteOne({ _id: oId, familyId: ctx.familyId });
}
