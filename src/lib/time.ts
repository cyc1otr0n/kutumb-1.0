/**
 * Timezone helpers without extra dependencies.
 * Families live in a timezone; "tomorrow at 11" must mean 11:00 in *their* timezone,
 * regardless of where the server runs.
 */

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: string;
}

const partsFormatterCache = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(tz: string): Intl.DateTimeFormat {
  let f = partsFormatterCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "long",
      hourCycle: "h23",
    });
    partsFormatterCache.set(tz, f);
  }
  return f;
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function zonedParts(date: Date, tz: string): ZonedParts {
  const parts = partsFormatter(tz).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "0";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")) % 24,
    minute: Number(get("minute")),
    second: Number(get("second")),
    weekday: get("weekday"),
  };
}

function offsetMs(date: Date, tz: string): number {
  const p = zonedParts(date, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** Validates a YYYY-MM-DD string is a real calendar date. */
export function isRealDate(dateKey: string): boolean {
  if (!DATE_RE.test(dateKey)) return false;
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** Converts a wall-clock date/time in `tz` into the absolute UTC instant. */
export function zonedToUtc(dateKey: string, time: string, tz: string): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const first = offsetMs(new Date(guess), tz);
  let result = guess - first;
  const second = offsetMs(new Date(result), tz);
  if (second !== first) result = guess - second;
  return new Date(result);
}

/** YYYY-MM-DD of an instant as seen in `tz`. */
export function dateKeyInTz(date: Date, tz: string): string {
  const p = zonedParts(date, tz);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export function timeInTz(date: Date, tz: string): string {
  const p = zonedParts(date, tz);
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
}

export function addDaysToKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export function startOfDayUtc(dateKey: string, tz: string): Date {
  return zonedToUtc(dateKey, "00:00", tz);
}

/** [start, end) UTC range covering `days` local days starting at dateKey. */
export function dayRangeUtc(dateKey: string, tz: string, days = 1): { start: Date; end: Date } {
  return { start: startOfDayUtc(dateKey, tz), end: startOfDayUtc(addDaysToKey(dateKey, days), tz) };
}

export function weekdayOfKey(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
}

export function formatDateTime(date: Date | string, tz: string, opts: { allDay?: boolean } = {}): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const day = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: tz });
  if (opts.allDay) return day;
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz });
  return `${day} · ${time}`;
}

export function formatTime(date: Date | string, tz: string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz });
}

/** "Today", "Tomorrow", "Yesterday" or a short date, relative to now in `tz`. */
export function relativeDayLabel(date: Date | string, tz: string, now = new Date()): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const key = dateKeyInTz(d, tz);
  const today = dateKeyInTz(now, tz);
  if (key === today) return "Today";
  if (key === addDaysToKey(today, 1)) return "Tomorrow";
  if (key === addDaysToKey(today, -1)) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: tz });
}

export function greetingFor(now: Date, tz: string): string {
  const h = zonedParts(now, tz).hour;
  if (h < 5) return "Good night";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

// ---------------------------------------------------------------------------
// Natural-language date resolution ("tomorrow", "this Friday", "next week"...)
// ---------------------------------------------------------------------------

const WEEKDAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const MONTH_NAMES = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** 0 = Sunday … 6 = Saturday for a YYYY-MM-DD key. */
export function weekdayIndexOfKey(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** "Mon, Oct 5" for a YYYY-MM-DD key. */
export function shortLabelOfKey(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export interface ResolvedDateRange {
  /** First local day (YYYY-MM-DD) in the family timezone. */
  startKey: string;
  /** Number of local days covered (>= 1). */
  days: number;
  /** Human label, e.g. "tomorrow (Mon, Oct 5)". */
  label: string;
}

function range(startKey: string, days: number, phrase: string): ResolvedDateRange {
  const endKey = addDaysToKey(startKey, days - 1);
  const span = days === 1 ? shortLabelOfKey(startKey) : `${shortLabelOfKey(startKey)} – ${shortLabelOfKey(endKey)}`;
  return { startKey, days, label: phrase ? `${phrase} (${span})` : span };
}

/**
 * Resolves relative / explicit date phrases in free text against "now" in the family timezone.
 * Returns null when the text contains no recognizable date reference.
 */
export function resolveDateRange(text: string, tz: string, now = new Date()): ResolvedDateRange | null {
  const t = ` ${text.toLowerCase().replace(/[’']/g, "'")} `;
  const today = dateKeyInTz(now, tz);
  const dow = weekdayIndexOfKey(today);

  if (/\bday after tomorrow\b/.test(t)) return range(addDaysToKey(today, 2), 1, "the day after tomorrow");
  if (/\b(tomorrow|tmrw|tmr|tomorow|tommorow|tommorrow)\b/.test(t)) return range(addDaysToKey(today, 1), 1, "tomorrow");
  if (/\byesterday\b/.test(t)) return range(addDaysToKey(today, -1), 1, "yesterday");
  if (/\b(today|tonight|this (morning|afternoon|evening))\b/.test(t)) return range(today, 1, "today");

  // Explicit ISO date
  const iso = t.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (iso && isRealDate(iso[1])) return range(iso[1], 1, "");

  // "Oct 12", "October 12th", "12 Oct", "12th of October"
  const MONTH_RE =
    "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
  const monthFirst = t.match(new RegExp(`\\b${MONTH_RE}\\.?\\s+(\\d{1,2})(st|nd|rd|th)?\\b`));
  const dayFirst = t.match(new RegExp(`\\b(\\d{1,2})(st|nd|rd|th)?\\s+(of\\s+)?${MONTH_RE}\\b`));
  if (monthFirst || dayFirst) {
    const monthIdx = MONTH_NAMES.indexOf((monthFirst ? monthFirst[1] : dayFirst![4]).slice(0, 3));
    const day = Number(monthFirst ? monthFirst[2] : dayFirst![1]);
    let year = Number(today.slice(0, 4));
    let key = `${year}-${String(monthIdx + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (isRealDate(key)) {
      if (key < today) {
        year += 1;
        key = `${year}-${key.slice(5)}`;
      }
      if (isRealDate(key)) return range(key, 1, "");
    }
  }

  // Weekends
  const daysToSat = (6 - dow + 7) % 7;
  if (/\bnext weekend\b/.test(t)) {
    const sat = addDaysToKey(today, dow === 0 ? 6 : daysToSat + 7);
    return range(sat, 2, "next weekend");
  }
  if (/\b(this |the |coming )?weekend\b/.test(t)) {
    if (dow === 0) return range(today, 1, "this weekend");
    return range(addDaysToKey(today, daysToSat), 2, "this weekend");
  }

  // Weeks
  if (/\bnext week\b/.test(t)) {
    const daysToMon = (1 - dow + 7) % 7 || 7;
    return range(addDaysToKey(today, daysToMon), 7, "next week");
  }
  if (/\b(this|rest of the|the rest of this) week\b/.test(t)) {
    const remaining = dow === 0 ? 1 : 8 - dow; // through Sunday
    return range(today, remaining, "this week");
  }

  // "next 3 days", "coming few days", "next couple of days"
  const nDays = t.match(/\b(next|coming|upcoming)\s+(\d{1,2}|few|couple of|couple)\s+days\b/);
  if (nDays) {
    const n = /^\d+$/.test(nDays[2]) ? Number(nDays[2]) : nDays[2].startsWith("few") ? 3 : 2;
    return range(today, Math.min(Math.max(n, 1), 31) + 1, `the next ${n} days`);
  }

  if (/\bthis month\b/.test(t)) {
    const [y, m] = today.split("-").map(Number);
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const remaining = lastDay - Number(today.slice(8, 10)) + 1;
    return range(today, remaining, "this month");
  }
  if (/\bnext month\b/.test(t)) {
    const [y, m] = today.split("-").map(Number);
    const first = new Date(Date.UTC(y, m, 1));
    const key = first.toISOString().slice(0, 10);
    const len = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
    return range(key, len, "next month");
  }

  // Weekday names: "friday", "this friday", "next friday", "on fri"
  const wd = t.match(/\b(this |next |on |coming |upcoming )?(sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)(day|nesday|sday|urday|rsday)?\b/);
  if (wd) {
    const idx = WEEKDAY_NAMES.findIndex((n) => n.startsWith(wd[2]));
    if (idx >= 0) {
      let delta = (idx - dow + 7) % 7;
      const modifier = (wd[1] || "").trim();
      if (modifier === "next") delta = delta === 0 ? 7 : delta < 2 ? delta + 7 : delta;
      const name = WEEKDAY_NAMES[idx][0].toUpperCase() + WEEKDAY_NAMES[idx].slice(1);
      const phrase = delta === 0 ? `today, ${name}` : `${modifier === "next" ? "next" : "this"} ${name}`;
      return range(addDaysToKey(today, delta), 1, phrase);
    }
  }

  return null;
}

/**
 * Builds a compact calendar block for LLM system prompts so relative dates
 * ("tomorrow", "this Friday") are always resolved against the real current date.
 */
export function buildCalendarContext(tz: string, now = new Date()): string {
  const today = dateKeyInTz(now, tz);
  const timeStr = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz });
  const longDate = now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: tz,
  });
  const lines: string[] = [];
  for (let i = 0; i < 14; i++) {
    const key = addDaysToKey(today, i);
    const tag = i === 0 ? " (today)" : i === 1 ? " (tomorrow)" : "";
    lines.push(`  ${key} = ${weekdayOfKey(key)}${tag}`);
  }
  return `CURRENT DATE & TIME: ${longDate}, ${timeStr} (timezone ${tz}).
Today = ${today}. Tomorrow = ${addDaysToKey(today, 1)}. Yesterday = ${addDaysToKey(today, -1)}.
Calendar for the next 14 days:
${lines.join("\n")}`;
}

