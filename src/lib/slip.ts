import { COMPANY } from "./config";
import { datesInMonth, daysInMonth, isWeeklyOff, monthLabel } from "./dates";
import { amountInWords, formatAmount } from "./format";
import type { Payslip } from "./types";

export type SlipRow = { label: string; value: string; tone?: "danger" };

function ordinalDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const suffix = d % 100 >= 11 && d % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[d % 10] ?? "th";
  const month = new Intl.DateTimeFormat("en-IN", { timeZone: "UTC", month: "long" }).format(new Date(Date.UTC(y, m - 1, 1)));
  return `${d}${suffix} ${month} ${y}`;
}

/**
 * Slips saved by earlier versions of the app lack newer fields (PAN, bank, conveyance, attendance counts...)
 * and may carry the old single "allowances" amount. Fill the gaps so old slips still open and print.
 */
export function withSlipDefaults(slip: Payslip): Payslip {
  const old = slip as Partial<Payslip> & { allowances?: number };
  const num = (v: unknown, fallback = 0) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
  const text = (v: unknown) => (typeof v === "string" ? v : "");
  const gross = num(old.gross);
  const paidLeave = num(old.paid_leave_days);
  return {
    ...slip,
    designation: text(old.designation),
    department: text(old.department),
    pan: text(old.pan),
    uan: text(old.uan),
    bank_name: text(old.bank_name),
    bank_account: text(old.bank_account),
    basic: num(old.basic),
    hra: num(old.hra),
    conveyance: num(old.conveyance),
    medical: num(old.medical),
    // Older slips had one "other allowances" amount; show it as the special allowance so earnings still add up.
    special: num(old.special, num(old.allowances)),
    gross,
    overtime_pay: num(old.overtime_pay),
    overtime_hours: num(old.overtime_hours),
    lop_days: num(old.lop_days),
    lop_deduction: num(old.lop_deduction),
    pf: num(old.pf),
    professional_tax: num(old.professional_tax),
    esi: num(old.esi),
    tds: num(old.tds),
    paid_days: num(old.paid_days),
    paid_leave_days: paidLeave,
    present_days: num(old.present_days, num(old.paid_days)),
    weekly_offs: num(old.weekly_offs, datesInMonth(slip.month).filter(isWeeklyOff).length),
    leave_taken: num(old.leave_taken, paidLeave),
    per_day: num(old.per_day, Math.round((gross / daysInMonth(slip.month)) * 100) / 100),
    net: num(old.net),
  };
}

/**
 * Everything printed on a salary slip, in the company template's order. Rows are laid out two per line
 * in the Employee Information and Attendance & Leave tables (left, right, left, right ...).
 */
export function buildSlipModel(stored: Payslip, joinDate: string | null) {
  const slip = withSlipDefaults(stored);
  const days = (n: number) => formatAmount(n);
  const or = (v: string, fallback = "NA") => v.trim() || fallback;

  const info: SlipRow[] = [
    { label: "Employee Name", value: slip.emp_name },
    { label: "Employee ID", value: slip.emp_code },
    { label: "Designation", value: or(slip.designation, "-") },
    { label: "PAN", value: or(slip.pan) },
    { label: "Department", value: or(slip.department, "-") },
    { label: "UAN / PF Number", value: or(slip.uan) },
    { label: "Date of Joining", value: joinDate ? ordinalDate(joinDate) : "-" },
    { label: "Bank Name", value: or(slip.bank_name) },
    { label: "Bank A/C Number", value: or(slip.bank_account) },
    { label: "Pay Period", value: monthLabel(slip.month) },
  ];

  const attendance: SlipRow[] = [
    { label: "Total Days in Month", value: String(daysInMonth(slip.month)) },
    { label: "Present (Worked) Days", value: days(slip.present_days) },
    { label: "Weekly Offs (Sundays)", value: String(slip.weekly_offs) },
    { label: "Leave Taken", value: days(slip.leave_taken) },
    { label: "Leave Allowed (Paid)", value: days(slip.paid_leave_days) },
    { label: "Unpaid Leave (LOP Days)", value: days(slip.lop_days), tone: "danger" },
    { label: "Total Payable Days", value: days(slip.paid_days) },
    { label: "Per Day Salary", value: `₹ ${formatAmount(slip.per_day)}` },
  ];

  const totalEarnings = slip.gross + slip.overtime_pay;
  const earnings: SlipRow[] = [
    { label: "Basic Salary", value: formatAmount(slip.basic) },
    { label: "House Rent Allowance", value: formatAmount(slip.hra) },
    { label: "Conveyance Allowance", value: formatAmount(slip.conveyance) },
    { label: "Medical Allowance", value: formatAmount(slip.medical) },
    { label: "Special Allowance", value: formatAmount(slip.special) },
    ...(slip.overtime_pay > 0 ? [{ label: `Overtime (${slip.overtime_hours} h)`, value: formatAmount(slip.overtime_pay) }] : []),
  ];

  const totalDeductions = slip.lop_deduction + slip.pf + slip.professional_tax + slip.esi + slip.tds;
  const deductions: SlipRow[] = [
    { label: `Loss of Pay (${days(slip.lop_days)} Days)`, value: formatAmount(slip.lop_deduction), tone: "danger" },
    { label: "Provident Fund (EPF)", value: formatAmount(slip.pf, true) },
    { label: "Professional Tax", value: formatAmount(slip.professional_tax, true) },
    { label: "Employee State Insurance", value: formatAmount(slip.esi, true) },
    { label: "TDS (Income Tax)", value: formatAmount(slip.tds, true) },
  ];

  return {
    company: COMPANY,
    title: `PAYSLIP FOR THE MONTH OF ${monthLabel(slip.month).toUpperCase()}`,
    info,
    attendance,
    earnings,
    totalEarnings: formatAmount(totalEarnings),
    deductions,
    totalDeductions: formatAmount(totalDeductions, true),
    net: `₹ ${formatAmount(slip.net)}`,
    words: `Amount in Words: ${slip.net_words?.trim() || amountInWords(slip.net)}`,
    fileName: `Salary-Slip-${slip.emp_name.replace(/[^A-Za-z0-9]+/g, "-")}-${slip.month}.pdf`,
  };
}

export type SlipModel = ReturnType<typeof buildSlipModel>;
