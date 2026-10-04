/**
 * Data transfer objects shared by API routes and client components.
 * This file must stay free of server imports.
 */

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

export interface ActionPreviewDTO {
  kind: ActionKind;
  title: string;
  details: { label: string; value: string }[];
  warnings: string[];
  destructive: boolean;
}

export interface PendingActionDTO {
  id: string;
  kind: ActionKind;
  preview: ActionPreviewDTO;
  status: "pending" | "confirmed" | "dismissed" | "failed";
  result: { entityId: string | null; message: string } | null;
}

export interface MemberDTO {
  id: string;
  name: string;
  relation: string | null;
  birthday: string | null;
  hasAccount: boolean;
  isYou: boolean;
  color: string;
}

export interface EventDTO {
  id: string;
  title: string;
  startsAt: string;
  allDay: boolean;
  description: string | null;
  location: string | null;
  dayLabel: string;
  timeLabel: string | null;
  dateKey: string;
}

export interface TaskDTO {
  id: string;
  title: string;
  notes: string | null;
  dueAt: string | null;
  dueLabel: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  status: "open" | "done";
  relatedEventId: string | null;
  completedAt: string | null;
}

export interface UpdateDTO {
  id: string;
  authorName: string;
  content: string;
  source: "text" | "voice" | "assistant" | "reminder";
  createdAt: string;
}

export const MEMORY_CATEGORY_LIST = [
  "person",
  "preference",
  "event",
  "decision",
  "household",
  "recurring",
  "miscellaneous",
] as const;
export type MemoryCategoryDTO = (typeof MEMORY_CATEGORY_LIST)[number];

export interface MemoryDTO {
  id: string;
  content: string;
  category: MemoryCategoryDTO;
  source: "manual" | "assistant" | "voice";
  createdAt: string;
}

export interface ReminderDTO {
  id: string;
  message: string;
  fireAt: string;
  fireLabel: string;
  audience: string;
  status: "scheduling" | "scheduled" | "delivered" | "cancelled" | "failed";
  failureReason: string | null;
  deliveredAt: string | null;
}

export interface ActivityDTO {
  id: string;
  actorName: string;
  type: string;
  summary: string;
  entityType: string | null;
  entityId: string | null;
  createdAt: string;
}

export interface DigestSectionDTO {
  title: string;
  items: string[];
}

export interface DigestDTO {
  id: string;
  period: "daily" | "weekly";
  headline: string;
  sections: DigestSectionDTO[];
  generatedBy: "gemma" | "fallback";
  createdAt: string;
  /** Script read aloud in the browser via window.speechSynthesis. */
  spokenText: string;
}

export interface MeDTO {
  user: { id: string; name: string; email: string };
  family: { id: string; name: string; timezone: string; inviteCode: string } | null;
  memberId: string | null;
}

export interface HomeDTO {
  greeting: string;
  userName: string;
  familyName: string;
  timezone: string;
  todayLabel: string;
  today: EventDTO[];
  tasksDueToday: TaskDTO[];
  openTasks: TaskDTO[];
  upcoming: EventDTO[];
  updates: UpdateDTO[];
  reminders: ReminderDTO[];
  recentlyDelivered: ReminderDTO[];
}

export interface AskTurn {
  role: "user" | "assistant";
  content: string;
}

export interface AskResponseDTO {
  reply: string;
  actions: PendingActionDTO[];
  toolsUsed: string[];
}

export interface VoiceResponseDTO {
  voiceUpdateId: string;
  transcript: string | null;
  reply: string | null;
  actions: PendingActionDTO[];
  toolsUsed: string[];
  error: string | null;
  stage: "transcription" | "processing" | null;
}

export interface ApiErrorBody {
  error: { code: string; message: string };
}
