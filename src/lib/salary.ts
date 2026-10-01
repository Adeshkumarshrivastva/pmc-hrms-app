import { datesInMonth } from "./dates";
import { leaveDateMap } from "./leave";
import { computeSalary, type DayContext } from "./payroll";
import { holidaysBetween, listAttendanceForMonth, listLeavesOverlapping } from "./queries";
import type { Employee } from "./types";

/** Holidays + approved leave for one employee's month (needed to classify days). */
export async function loadDayContext(employeeId: number, month: string): Promise<DayContext> {
  const dates = datesInMonth(month);
  const from = dates[0];
  const to = dates[dates.length - 1];
  const holidays = await holidaysBetween(from, to);
  const leaves = leaveDateMap(await listLeavesOverlapping(employeeId, from, to, ["APPROVED"]), holidays, from, to);
  return { holidays, leaves };
}

/** Attendance, holidays and leave for the month -> full salary computation. */
export async function getMonthSalary(employee: Employee, month: string, today: string) {
  const [records, ctx] = await Promise.all([listAttendanceForMonth(employee.id, month), loadDayContext(employee.id, month)]);
  return computeSalary(employee, month, records, today, ctx);
}
