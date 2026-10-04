import { ObjectId } from "mongodb";
import { collections } from "../db/client";
import type { ActivityDoc, ActivityType, FamilyDoc, FamilyMemberDoc, UserDoc } from "../db/types";
import { AppError, invalid, notFound } from "../errors";
import { isValidTimeZone } from "@/lib/time";
import type { AuthContext } from "../context";
import { toObjectId } from "../context";

export async function logActivity(
  familyId: ObjectId,
  actor: { userId: ObjectId | null; name: string },
  type: ActivityType,
  summary: string,
  entity?: { type: ActivityDoc["entityType"]; id: ObjectId | null }
): Promise<void> {
  const { activity } = await collections();
  const doc: ActivityDoc = {
    _id: new ObjectId(),
    familyId,
    actorUserId: actor.userId,
    actorName: actor.name,
    type,
    summary,
    entityType: entity?.type ?? null,
    entityId: entity?.id ?? null,
    createdAt: new Date(),
  };
  await activity.insertOne(doc);
}

export async function createFamily(
  creatorUser: UserDoc,
  name: string,
  timezone: string
): Promise<{ family: FamilyDoc; member: FamilyMemberDoc }> {
  if (!name.trim()) throw invalid("Family name is required");
  const cleanTz = timezone?.trim() || "UTC";
  if (!isValidTimeZone(cleanTz)) throw invalid(`Invalid timezone: ${cleanTz}`);

  const { families, members, users } = await collections();

  const familyId = new ObjectId();
  const memberId = new ObjectId();
  const inviteCode = "KUTUMB-" + Math.random().toString(36).substring(2, 8).toUpperCase();

  const familyDoc: FamilyDoc = {
    _id: familyId,
    name: name.trim(),
    timezone: cleanTz,
    inviteCode,
    createdBy: creatorUser._id,
    createdAt: new Date(),
  };

  const memberDoc: FamilyMemberDoc = {
    _id: memberId,
    familyId,
    name: creatorUser.name,
    relation: "Self",
    birthday: null,
    userId: creatorUser._id,
    color: "#4f46e5", // Indigo
    createdAt: new Date(),
  };

  await families.insertOne(familyDoc);
  await members.insertOne(memberDoc);

  await users.updateOne(
    { _id: creatorUser._id },
    { $set: { familyId, memberId } }
  );

  await logActivity(
    familyId,
    { userId: creatorUser._id, name: creatorUser.name },
    "member_added",
    `${creatorUser.name} created the family "${familyDoc.name}"`,
    { type: "member", id: memberId }
  );

  return { family: familyDoc, member: memberDoc };
}

export async function joinFamilyByCode(
  user: UserDoc,
  inviteCode: string,
  relation?: string
): Promise<{ family: FamilyDoc; member: FamilyMemberDoc }> {
  const cleanCode = inviteCode.trim().toUpperCase();
  const { families, members, users } = await collections();

  const family = await families.findOne({ inviteCode: cleanCode });
  if (!family) throw notFound("family with this invite code");

  // Check if member already exists for this user
  let member = await members.findOne({ familyId: family._id, userId: user._id });
  if (!member) {
    member = {
      _id: new ObjectId(),
      familyId: family._id,
      name: user.name,
      relation: relation?.trim() || null,
      birthday: null,
      userId: user._id,
      color: "#059669", // Emerald
      createdAt: new Date(),
    };
    await members.insertOne(member);
  }

  await users.updateOne(
    { _id: user._id },
    { $set: { familyId: family._id, memberId: member._id } }
  );

  await logActivity(
    family._id,
    { userId: user._id, name: user.name },
    "member_added",
    `${user.name} joined the family`,
    { type: "member", id: member._id }
  );

  return { family, member };
}

export async function addFamilyMember(
  ctx: AuthContext,
  data: { name: string; relation?: string; birthday?: string; color?: string }
): Promise<FamilyMemberDoc> {
  if (!data.name?.trim()) throw invalid("Member name is required");
  const { members } = await collections();

  const memberDoc: FamilyMemberDoc = {
    _id: new ObjectId(),
    familyId: ctx.familyId,
    name: data.name.trim(),
    relation: data.relation?.trim() || null,
    birthday: data.birthday?.trim() || null,
    userId: null,
    color: data.color || "#e11d48", // Rose
    createdAt: new Date(),
  };

  await members.insertOne(memberDoc);

  await logActivity(
    ctx.familyId,
    { userId: ctx.userId, name: ctx.userName },
    "member_added",
    `${ctx.userName} added ${memberDoc.name} to the family`,
    { type: "member", id: memberDoc._id }
  );

  return memberDoc;
}

export async function getFamilyMembers(familyId: ObjectId): Promise<FamilyMemberDoc[]> {
  const { members } = await collections();
  return members.find({ familyId }).sort({ createdAt: 1 }).toArray();
}

export async function findMemberByName(familyId: ObjectId, name: string): Promise<FamilyMemberDoc | null> {
  const { members } = await collections();
  const trimmed = name.trim();
  // Exact or case-insensitive match
  return members.findOne({
    familyId,
    name: { $regex: new RegExp(`^${trimmed}$`, "i") },
  });
}
