import { cookies } from "next/headers";
import { readSessionToken, SESSION_COOKIE } from "./session";
import { collections } from "../db/client";
import { ObjectId } from "mongodb";
import { AppError } from "../errors";
import type { AuthContext } from "../context";
import type { UserDoc } from "../db/types";

export async function getSessionUser(): Promise<UserDoc | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const session = readSessionToken(token);
  if (!session) return null;

  if (!ObjectId.isValid(session.userId)) return null;
  const { users } = await collections();
  return users.findOne({ _id: new ObjectId(session.userId) });
}

export async function requireAuth(): Promise<UserDoc> {
  const user = await getSessionUser();
  if (!user) {
    throw new AppError("unauthenticated", "Please sign in to continue.");
  }
  return user;
}

export async function requireFamilyAuth(): Promise<AuthContext> {
  const user = await requireAuth();

  if (!user.familyId) {
    throw new AppError("no_family", "You need to create or join a family first.");
  }

  const { families } = await collections();
  const family = await families.findOne({ _id: user.familyId });
  if (!family) {
    throw new AppError("no_family", "Family not found.");
  }

  return {
    userId: user._id,
    familyId: family._id,
    memberId: user.memberId,
    userName: user.name,
    familyName: family.name,
    timezone: family.timezone || "UTC",
  };
}
