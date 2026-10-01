import { RULES, TZ } from "./config";

/** "YYYY-MM-DD" in company timezone. */
export function todayStr(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
}

/** "YYYY-MM" in company timezone. */
export function monthStr(d: Date = new Date()): string {
  return todayStr(d).slice(0, 7);
}

export function isValidMonth(m: unknown): m is string {
  return typeof m === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(m);
}

export function isValidDate(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));
}

/** "dd-mm-yyyy" (also accepts / or . and 1-digit day/month) -> "yyyy-mm-dd"; "" if it isn't a real date. */
export function parseDmy(s: string): string {
  const m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(s.trim());
  if (!m) return "";
  const iso = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return isValidDate(iso) ? iso : "";
}

/** "yyyy-mm-dd" -> "dd-mm-yyyy" */
export const toDmy = (iso: string) => iso.split("-").reverse().join("-");

export function fmtTime(iso?: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}

export function fmtDate(dateStr: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
    weekday: "short",
  }).format(new Date(dateStr + "T00:00:00Z"));
}

export function fmtDateLong(dateStr: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "UTC",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(dateStr + "T00:00:00Z"));
}

export function monthLabel(month: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  }).format(new Date(month + "-01T00:00:00Z"));
}

export function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** All "YYYY-MM-DD" strings in a month. */
export function datesInMonth(month: string): string[] {
  return Array.from({ length: daysInMonth(month) }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`);
}

export function dayOfWeek(dateStr: string): number {
  return new Date(dateStr + "T00:00:00Z").getUTCDay();
}

export function isWeeklyOff(dateStr: string): boolean {
  return RULES.weeklyOff.includes(dayOfWeek(dateStr));
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** "YYYY-MM-DDTHH:mm" (IST wall clock) -> ISO UTC string. */
export function istLocalToIso(local: string): string {
  return new Date(`${local}:00+05:30`).toISOString();
}

/** ISO UTC string -> "YYYY-MM-DDTHH:mm" in company timezone (for datetime-local inputs). */
export function isoToIstLocal(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/** Minutes since midnight (company timezone) for an ISO timestamp. */
export function istMinutes(iso: string): number {
  const [h, m] = isoToIstLocal(iso).slice(11).split(":").map(Number);
  return h * 60 + m;
}

export function hoursBetween(startIso: string, endIso: string): number {
  return Math.max(0, (Date.parse(endIso) - Date.parse(startIso)) / 3_600_000);
}

export function fmtHours(h: number): string {
  const mins = Math.round(h * 60);
  return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, "0")}m`;
}
