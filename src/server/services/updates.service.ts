import { ObjectId } from "mongodb";
import { collections } from "../db/client";
import type { FamilyUpdateDoc, UpdateSource } from "../db/types";
import { invalid } from "../errors";
import type { AuthContext } from "../context";
import { logActivity } from "./family.service";
import type { UpdateDTO } from "@/lib/types";

export function toUpdateDTO(doc: FamilyUpdateDoc): UpdateDTO {
  return {
    id: doc._id.toHexString(),
    authorName: doc.authorName,
    content: doc.content,
    source: doc.source,
    createdAt: doc.createdAt.toISOString(),
  };
}

export async function createFamilyUpdate(
  ctx: AuthContext,
  content: string,
  source: UpdateSource = "text"
): Promise<FamilyUpdateDoc> {
  if (!content?.trim()) throw invalid("Update content cannot be empty");

  const { updates } = await collections();
  const doc: FamilyUpdateDoc = {
    _id: new ObjectId(),
    familyId: ctx.familyId,
    authorUserId: ctx.userId,
    authorName: ctx.userName,
    content: content.trim(),
    source,
    createdAt: new Date(),
  };

  await updates.insertOne(doc);

  await logActivity(
    ctx.familyId,
    { userId: ctx.userId, name: ctx.userName },
    "update_posted",
    `${ctx.userName} shared an update: "${doc.content.length > 50 ? doc.content.slice(0, 47) + "..." : doc.content}"`,
    { type: "update", id: doc._id }
  );

  return doc;
}

export async function getFamilyUpdates(familyId: ObjectId, limit = 20): Promise<FamilyUpdateDoc[]> {
  const { updates } = await collections();
  return updates.find({ familyId }).sort({ createdAt: -1 }).limit(limit).toArray();
}
