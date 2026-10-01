import { RULES } from "./config";
import { datesInMonth, hoursBetween, isWeeklyOff, istMinutes } from "./dates";
import type { LeaveDay } from "./leave";
import type { Attendance, Employee, Payslip } from "./types";

export type DayStatus =
  | "PRESENT" | "HALF_DAY" | "INCOMPLETE" | "ABSENT"
  | "LEAVE" | "UNPAID_LEAVE" | "HOLIDAY" | "WEEKLY_OFF" | "NOT_IN" | "FUTURE";

export type DayContext = { holidays: Set<string>; leaves: Map<string, LeaveDay> };

export type DayRecord = {
  date: string;
  status: DayStatus;
  /** 1 = full day, 0.5 = half day, 0 otherwise (attendance + paid leave, capped at 1) */
  credit: number;
  hours: number;
  overtime: number;
  late: boolean;
  /** Minutes after shift start (10:00) the employee punched in; 0 if on time. */
  lateMinutes: number;
  record: Attendance | null;
};

const [SHIFT_H, SHIFT_M] = RULES.shiftStart.split(":").map(Number);
const SHIFT_START_MINUTES = SHIFT_H * 60 + SHIFT_M;
const LATE_AFTER_MINUTES = SHIFT_START_MINUTES + RULES.lateGraceMinutes;

const isOffDay = (date: string, ctx: DayContext) => isWeeklyOff(date) || ctx.holidays.has(date);

function overtimeHours(hours: number, off: boolean): number {
  const raw = off ? hours : hours - RULES.fullDayHours;
  return raw * 60 >= RULES.overtimeMinMinutes ? raw : 0;
}

/** Classifies one day from punches, approved leave and the holiday calendar. */
export function classifyDay(date: string, record: Attendance | null, today: string, ctx: DayContext): DayRecord {
  const leave = ctx.leaves.get(date);
  const off = isOffDay(date, ctx);

  if (record) {
    const punchIn = istMinutes(record.punch_in);
    const late = punchIn > LATE_AFTER_MINUTES;
    const lateMinutes = Math.max(0, punchIn - SHIFT_START_MINUTES);
    const base = { date, late, lateMinutes, record };
    if (!record.punch_out) {
      return { ...base, status: "INCOMPLETE", credit: leave?.paid ? leave.credit : 0, hours: 0, overtime: 0 };
    }
    const hours = hoursBetween(record.punch_in, record.punch_out);
    const overtime = overtimeHours(hours, off);
    let status: DayStatus = "ABSENT";
    let credit = 0;
    if (hours >= RULES.fullDayHours) { status = "PRESENT"; credit = 1; }
    else if (hours >= RULES.halfDayHours) { status = "HALF_DAY"; credit = 0.5; }
    if (leave?.paid) credit = Math.min(1, credit + leave.credit);
    return { ...base, status, credit, hours, overtime };
  }

  const empty = { date, credit: 0, hours: 0, overtime: 0, late: false, lateMinutes: 0, record: null };
  if (leave) {
    return leave.paid
      ? { ...empty, status: "LEAVE", credit: leave.credit }
      : { ...empty, status: "UNPAID_LEAVE" };
  }
  if (ctx.holidays.has(date)) return { ...empty, status: "HOLIDAY" };
  if (date > today) return { ...empty, status: "FUTURE" };
  if (isWeeklyOff(date)) return { ...empty, status: "WEEKLY_OFF" };
  // Today isn't over: nobody is "absent" yet, and the day is not counted as unpaid until it ends.
  if (date === today) return { ...empty, status: "NOT_IN" };
  return { ...empty, status: "ABSENT" };
}

export function buildMonth(month: string, records: Attendance[], today: string, ctx: DayContext): DayRecord[] {
  const byDate = new Map(records.map((r) => [r.date, r]));
  return datesInMonth(month).map((d) => classifyDay(d, byDate.get(d) ?? null, today, ctx));
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Salary for a month, following the company salary-slip format.
 * - Per-day salary = gross / days in the month; Total payable days = days in month - LOP days.
 * - LOP days are elapsed working days (not weekly off / holiday) not covered by attendance or paid leave.
 * - Overtime (opt-in per employee) is paid at (per-day / 8h) x multiplier and added on top of gross.
 */
export function computeSalary(emp: Employee, month: string, records: Attendance[], today: string, ctx: DayContext) {
  const days = buildMonth(month, records, today, ctx);
  const calendarDays = days.length;
  const workingDays = days.filter((d) => !isOffDay(d.date, ctx)).length;

  const lopDays = days
    .filter((d) => d.date <= today && d.status !== "NOT_IN" && !isOffDay(d.date, ctx))
    .reduce((sum, d) => sum + (1 - d.credit), 0);
  const payableDays = calendarDays - lopDays;

  const gross = emp.basic + emp.hra + emp.conveyance + emp.medical + emp.special;
  const perDay = round2(gross / calendarDays);
  const lopDeduction = round2((gross / calendarDays) * lopDays);

  // PF is on earned basic (pro-rated for unpaid days) so a fully-absent month never nets negative.
  const earnedBasic = (emp.basic * payableDays) / calendarDays;
  const pf = emp.pf_enabled ? round2((earnedBasic * RULES.pfPercent) / 100) : 0;

  const overtimeHrs = emp.ot_enabled ? round2(days.reduce((s, d) => s + d.overtime, 0)) : 0;
  const overtimePay = round2(overtimeHrs * (gross / calendarDays / RULES.fullDayHours) * RULES.overtimeMultiplier);

  const totalEarnings = round2(gross + overtimePay);
  const totalDeductions = round2(lopDeduction + pf + emp.professional_tax + emp.esi + emp.tds);
  const net = round2(totalEarnings - totalDeductions);

  const leaveDays = [...ctx.leaves.entries()].filter(([date]) => date.startsWith(month + "-")).map(([, l]) => l);
  const presentDays = days.filter((d) => d.status === "PRESENT").length;
  const halfDays = days.filter((d) => d.status === "HALF_DAY").length;

  return {
    days,
    calendarDays,
    workingDays,
    paidDays: payableDays,
    lopDays,
    weeklyOffs: days.filter((d) => isWeeklyOff(d.date)).length,
    leaveTaken: leaveDays.reduce((s, l) => s + l.credit, 0),
    paidLeaveDays: leaveDays.filter((l) => l.paid).reduce((s, l) => s + l.credit, 0),
    holidayCount: days.filter((d) => ctx.holidays.has(d.date) && !isWeeklyOff(d.date)).length,
    workedDays: presentDays + halfDays * 0.5,
    perDay,
    basic: emp.basic,
    hra: emp.hra,
    conveyance: emp.conveyance,
    medical: emp.medical,
    special: emp.special,
    gross,
    lopDeduction,
    pf,
    professionalTax: emp.professional_tax,
    esi: emp.esi,
    tds: emp.tds,
    totalDeductions,
    overtimeHours: overtimeHrs,
    overtimePay,
    totalEarnings,
    net,
    presentDays,
    halfDays,
    lateCount: days.filter((d) => d.late).length,
    totalHours: days.reduce((s, d) => s + d.hours, 0),
  };
}

export type Salary = ReturnType<typeof computeSalary>;

export function salaryToPayslip(emp: Employee, month: string, s: Salary): Omit<Payslip, "id"> {
  return {
    employee_id: emp.id,
    month,
    emp_code: emp.emp_code,
    emp_name: emp.name,
    designation: emp.designation,
    department: emp.department,
    working_days: s.workingDays,
    paid_days: s.paidDays,
    lop_days: s.lopDays,
    paid_leave_days: s.paidLeaveDays,
    holidays: s.holidayCount,
    present_days: s.workedDays,
    weekly_offs: s.weeklyOffs,
    leave_taken: s.leaveTaken,
    per_day: s.perDay,
    overtime_hours: s.overtimeHours,
    pan: emp.pan,
    uan: emp.uan,
    bank_name: emp.bank_name,
    bank_account: emp.bank_account,
    basic: s.basic,
    hra: s.hra,
    conveyance: s.conveyance,
    medical: s.medical,
    special: s.special,
    gross: s.gross,
    overtime_pay: s.overtimePay,
    lop_deduction: s.lopDeduction,
    pf: s.pf,
    professional_tax: s.professionalTax,
    esi: s.esi,
    tds: s.tds,
    net: s.net,
    generated_at: new Date().toISOString(),
  };
}
