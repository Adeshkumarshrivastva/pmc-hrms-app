import { RULES } from "./config";
import { isWeeklyOff } from "./dates";
import { leaveDaysUsed, listLeavesOverlapping } from "./queries";
import type { LeaveRequest, LeaveType } from "./types";

export const PAID_LEAVE_TYPES = ["CASUAL", "SICK", "EARNED"] as const satisfies readonly LeaveType[];

/** Every "YYYY-MM-DD" from start to end inclusive. */
export function eachDate(start: string, end: string): string[] {
  const out: string[] = [];
  for (let t = Date.parse(start + "T00:00:00Z"); t <= Date.parse(end + "T00:00:00Z"); t += 86_400_000) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

/** Leave days = working days in range (weekly offs and holidays don't consume leave). */
export function countLeaveDays(start: string, end: string, holidays: Set<string>, halfDay: boolean): number {
  const days = eachDate(start, end).filter((d) => !isWeeklyOff(d) && !holidays.has(d)).length;
  return halfDay ? days * 0.5 : days;
}

export type LeaveDay = { paid: boolean; credit: number };

/** date -> leave credit for approved leaves within [from, to]. */
export function leaveDateMap(leaves: LeaveRequest[], holidays: Set<string>, from: string, to: string) {
  const map = new Map<string, LeaveDay>();
  for (const l of leaves) {
    if (l.status !== "APPROVED") continue;
    for (const d of eachDate(l.start_date < from ? from : l.start_date, l.end_date > to ? to : l.end_date)) {
      if (isWeeklyOff(d) || holidays.has(d)) continue;
      map.set(d, { paid: l.type !== "UNPAID", credit: l.half_day ? 0.5 : 1 });
    }
  }
  return map;
}

/** Paid leave days used in a year by statuses, summed over every paid type. */
const paidDays = async (employeeId: number, year: number, statuses: LeaveRequest["status"][], excludeId = 0) =>
  (await Promise.all(PAID_LEAVE_TYPES.map((t) => leaveDaysUsed(employeeId, t, year, statuses, excludeId)))).reduce((a, b) => a + b, 0);

/** One yearly pool of paid leave: how many are taken, waiting for approval, and left. */
export async function getBalance(employeeId: number, year: number) {
  const quota = RULES.paidLeavePerYear;
  const [used, pending] = await Promise.all([paidDays(employeeId, year, ["APPROVED"]), paidDays(employeeId, year, ["PENDING"])]);
  return { quota, used, pending, remaining: quota - used - pending };
}

/** Returns an error message if the request can't be granted, otherwise null. */
export async function validateLeave(opts: {
  employeeId: number; type: LeaveType; start: string; end: string; days: number; excludeId?: number;
}): Promise<string | null> {
  const { employeeId, type, start, end, days, excludeId = 0 } = opts;
  if (end < start) return "End date can't be before start date";
  if (start.slice(0, 4) !== end.slice(0, 4)) return "A leave request can't span two calendar years — split it into two";
  if (days <= 0) return "Those dates are all weekly offs or holidays — no leave needed";
  const clash = (await listLeavesOverlapping(employeeId, start, end, ["PENDING", "APPROVED"])).find((l) => l.id !== excludeId);
  if (clash) return `Overlaps with another leave request (${clash.start_date} to ${clash.end_date})`;
  if (type !== "UNPAID") {
    const quota = RULES.paidLeavePerYear;
    const taken = await paidDays(employeeId, Number(start.slice(0, 4)), ["APPROVED", "PENDING"], excludeId);
    if (taken + days > quota) {
      return `Not enough balance: ${Math.max(0, quota - taken)} paid leave day(s) left this year — choose Unpaid Leave instead`;
    }
  }
  return null;
}
