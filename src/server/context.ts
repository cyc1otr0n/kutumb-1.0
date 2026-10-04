import { ObjectId } from "mongodb";
import { notFound } from "./errors";

/** Parses an id string. Invalid ids are reported as "not found" so we never leak existence information. */
export function toObjectId(id: unknown, what: string): ObjectId {
  if (typeof id !== "string" || !ObjectId.isValid(id) || id.length !== 24) throw notFound(what);
  return new ObjectId(id);
}

/** The authenticated, server-derived context every family operation runs under. */
export interface AuthContext {
  userId: ObjectId;
  familyId: ObjectId;
  memberId: ObjectId | null;
  userName: string;
  familyName: string;
  timezone: string;
}
