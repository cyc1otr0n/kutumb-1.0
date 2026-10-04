import type { ObjectId, Binary } from "mongodb";

/**
 * MongoDB document shapes. Every family-scoped document carries `familyId`,
 * and every query in the service layer filters on the server-derived familyId.
 */

export interface UserDoc {
  _id: ObjectId;
  email: string;
  name: string;
  passwordHash: string;
  familyId: ObjectId | null;
  memberId: ObjectId | null;
  createdAt: Date;
}

export interface FamilyDoc {
  _id: ObjectId;
  name: string;
  timezone: string;
  inviteCode: string;
  createdBy: ObjectId;
  createdAt: Date;
}

export interface FamilyMemberDoc {
  _id: ObjectId;
  familyId: ObjectId;
  name: string;
  relation: string | null;
  /** "MM-DD" or "YYYY-MM-DD" */
  birthday: string | null;
  userId: ObjectId | null;
  color: string;
  createdAt: Date;
}

export interface EventDoc {
  _id: ObjectId;
  familyId: ObjectId;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: Date;
  allDay: boolean;
  createdBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TaskDoc {
  _id: ObjectId;
  familyId: ObjectId;
  title: string;
  notes: string | null;
  dueAt: Date | null;
  assigneeMemberId: ObjectId | null;
  relatedEventId: ObjectId | null;
  status: "open" | "done";
  createdBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
  completedBy: ObjectId | null;
}

export type ReminderStatus = "scheduling" | "scheduled" | "delivered" | "cancelled" | "failed";

export interface ReminderDoc {
  _id: ObjectId;
  familyId: ObjectId;
  message: string;
  fireAt: Date;
  /** Empty array means "everyone in the family". */
  audienceMemberIds: ObjectId[];
  relatedEventId: ObjectId | null;
  status: ReminderStatus;
  workflowId: string | null;
  failureReason: string | null;
  createdBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
  deliveredAt: Date | null;
  cancelledAt: Date | null;
}

export type UpdateSource = "text" | "voice" | "assistant" | "reminder";

export interface FamilyUpdateDoc {
  _id: ObjectId;
  familyId: ObjectId;
  authorUserId: ObjectId | null;
  authorName: string;
  content: string;
  source: UpdateSource;
  createdAt: Date;
}

export const MEMORY_CATEGORIES = [
  "person",
  "preference",
  "event",
  "decision",
  "household",
  "recurring",
  "miscellaneous",
] as const;
export type MemoryCategory = (typeof MEMORY_CATEGORIES)[number];

export interface MemoryAttachment {
  url: string;
  fileName: string;
  fileType: string;
  fileSize?: number;
}

export interface MemoryDoc {
  _id: ObjectId;
  familyId: ObjectId;
  createdBy: ObjectId;
  content: string;
  category: MemoryCategory;
  source: "manual" | "assistant" | "voice";
  attachments?: MemoryAttachment[];
  createdAt: Date;
  updatedAt: Date;
}

export interface DigestSection {
  title: string;
  items: string[];
}

export interface DailyDigestDoc {
  _id: ObjectId;
  familyId: ObjectId;
  period: "daily" | "weekly";
  dateKey: string;
  headline: string;
  sections: DigestSection[];
  spokenText: string;
  generatedBy: "gemma" | "fallback";
  model: string | null;
  /** Hash of the inputs; lets us reuse a digest until family data changes. */
  sourceSignature: string;
  audio: Binary | null;
  audioMimeType: string | null;
  createdAt: Date;
}

export type VoiceUpdateStatus = "transcribing" | "transcribed" | "processed" | "transcription_failed" | "processing_failed";

export interface VoiceUpdateDoc {
  _id: ObjectId;
  familyId: ObjectId;
  userId: ObjectId;
  status: VoiceUpdateStatus;
  transcript: string | null;
  mimeType: string;
  sizeBytes: number;
  error: string | null;
  pendingActionIds: ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

export type ActivityType =
  | "event_created"
  | "event_updated"
  | "event_deleted"
  | "task_created"
  | "task_assigned"
  | "task_completed"
  | "task_reopened"
  | "update_posted"
  | "memory_saved"
  | "reminder_scheduled"
  | "reminder_cancelled"
  | "reminder_delivered"
  | "member_added"
  | "voice_update";

export interface ActivityDoc {
  _id: ObjectId;
  familyId: ObjectId;
  actorUserId: ObjectId | null;
  actorName: string;
  type: ActivityType;
  summary: string;
  entityType: "event" | "task" | "update" | "memory" | "reminder" | "member" | "voice_update" | null;
  entityId: ObjectId | null;
  createdAt: Date;
}

export type ActionKind =
  | "create_event"
  | "update_event"
  | "delete_event"
  | "create_task"
  | "assign_task"
  | "complete_task"
  | "create_reminder"
  | "cancel_reminder"
  | "create_update"
  | "save_memory";

export interface ActionPreview {
  kind: ActionKind;
  title: string;
  details: { label: string; value: string }[];
  warnings: string[];
  destructive: boolean;
}

/**
 * An action proposed by the Kutumb agent. It is validated and authorised when proposed,
 * and re-validated when a family member confirms it. Nothing is written to family data
 * until confirmation.
 */
export interface PendingActionDoc {
  _id: ObjectId;
  familyId: ObjectId;
  userId: ObjectId;
  kind: ActionKind;
  payload: Record<string, unknown>;
  preview: ActionPreview;
  status: "pending" | "confirmed" | "dismissed" | "failed";
  result: { entityId: string | null; message: string } | null;
  source: "ask" | "voice";
  createdAt: Date;
  resolvedAt: Date | null;
  expiresAt: Date;
}
