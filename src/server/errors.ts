/**
 * Application errors carry a safe, user-facing message.
 * Internal details stay in `cause` and are only sent to observability, never to the client.
 */

export type AppErrorCode =
  | "unauthenticated"
  | "no_family"
  | "forbidden"
  | "not_found"
  | "invalid_input"
  | "conflict"
  | "database_unavailable"
  | "ai_unavailable"
  | "voice_unavailable"
  | "reminders_unavailable"
  | "not_configured";

const STATUS: Record<AppErrorCode, number> = {
  unauthenticated: 401,
  no_family: 403,
  forbidden: 403,
  not_found: 404,
  invalid_input: 400,
  conflict: 409,
  database_unavailable: 503,
  ai_unavailable: 503,
  voice_unavailable: 503,
  reminders_unavailable: 503,
  not_configured: 503,
};

export const USER_MESSAGES = {
  ai: "I couldn't process that right now. Please try again.",
  db: "I couldn't retrieve your family information right now.",
  voice: "Voice isn't available right now. Your words are safe — you can type them instead.",
  reminders: "I couldn't schedule that reminder right now, so it has not been set. Please try again.",
} as const;

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  readonly userMessage: string;

  constructor(code: AppErrorCode, userMessage: string, options?: { cause?: unknown }) {
    super(userMessage, options);
    this.name = "AppError";
    this.code = code;
    this.status = STATUS[code];
    this.userMessage = userMessage;
  }
}

export function isMongoError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const name = (err as { name?: string }).name ?? "";
  return name.startsWith("Mongo") || name === "BSONError";
}

/** Normalises any thrown value into an AppError with a safe message. */
export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  if (isMongoError(err)) return new AppError("database_unavailable", USER_MESSAGES.db, { cause: err });
  return new AppError("database_unavailable", "Something went wrong. Please try again.", { cause: err });
}

export const notFound = (what: string) => new AppError("not_found", `I couldn't find that ${what}.`);
export const invalid = (message: string) => new AppError("invalid_input", message);
