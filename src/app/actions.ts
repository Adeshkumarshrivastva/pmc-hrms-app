"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  clearPendingLogin, createSession, destroySession, getPendingLogin, requireAdmin, requireUser, setPendingLogin,
} from "@/lib/auth";
import { distanceMeters } from "@/lib/geo";
import { COMPANY } from "@/lib/config";
import { STATIC_MODE } from "@/lib/db";
import { checkOtp, sendOtp } from "@/lib/otp";
import { normalizePhone } from "@/lib/phone";
import {
  addDepartment, addDesignation, addHoliday, deleteAttendance, deleteHoliday, getAttendance, getEmployee, getEmployeeByEmail, getEmployeeByPhone,
  clearLocation, getLeave, getPayslip, holidaysBetween, insertEmployee, insertLeave, listEmployees, punchIn, punchOut, saveLocation, savePayslip,
  setLeaveStatus, updateEmployee, upsertAttendance,
} from "@/lib/queries";
import { isValidDate, parseDmy, isValidMonth, istLocalToIso, todayStr } from "@/lib/dates";
import { mailConfigured, sendMail } from "@/lib/mail";
import { salaryToPayslip } from "@/lib/payroll";
import { buildSlipPdf } from "@/lib/slip-pdf";
import { getMonthSalary } from "@/lib/salary";
import { withSlipDefaults } from "@/lib/slip";
import { countLeaveDays, validateLeave } from "@/lib/leave";
import { LEAVE_TYPE_LABELS, type LeaveType } from "@/lib/types";

export type FormState = { error?: string; ok?: string; sent?: boolean; phone?: string };

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const num = (fd: FormData, key: string) => {
  const n = Number(str(fd, key) || 0);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
};

/* ---------- auth ---------- */

export async function sendOtpAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const phone = normalizePhone(str(fd, "phone"));
  if (!phone) return { error: "Enter a valid 10-digit mobile number" };
  const user = await getEmployeeByPhone(phone);
  // Static mode (no database yet): a new number is welcomed and asked for its name after the OTP.
  if (!STATIC_MODE && (!user || !user.active)) return { error: "This number isn't registered. Ask your admin to add it." };
  if (user && !user.active) return { error: "This account is no longer active" };
  await sendOtp(phone);
  await setPendingLogin(phone);
  return { sent: true, phone };
}

export async function verifyOtpAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const pending = await getPendingLogin();
  if (!pending) return { error: "OTP expired. Please request a new one." };
  if (!(await checkOtp(pending.phone, str(fd, "otp")))) return { error: "Incorrect OTP" };
  let user = await getEmployeeByPhone(pending.phone);
  if (user && !user.active) return { error: "This account is no longer active" };
  if (!user) {
    if (!STATIC_MODE) return { error: "This number isn't registered. Ask your admin to add it." };
    // Static mode: first login of a new number creates an Admin account named after the number.
    await insertEmployee({
      emp_code: "", name: `User ${pending.phone.slice(-4)}`, email: `${pending.phone}@static.local`, phone: pending.phone, role: "ADMIN",
      designation: "Admin", department: "", join_date: todayStr(), pan: "", uan: "", bank_name: "", bank_account: "", basic: 16000, hra: 6400, conveyance: 1462, medical: 1142,
      special: 6996, pf_enabled: 0, professional_tax: 0, esi: 0, tds: 0, ot_enabled: 0, active: 1,
    });
  }
  user = await getEmployeeByPhone(pending.phone);
  if (!user) return { error: "Could not create your account" };
  await clearPendingLogin();
  await createSession(user.id);
  redirect("/dashboard");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}

/* ---------- punching ---------- */

export async function punchInAction(): Promise<FormState> {
  const user = await requireUser();
  const now = new Date();
  const date = todayStr(now);
  if (await getAttendance(user.id, date)) return { error: "You have already punched in today" };
  await punchIn(user.id, date, now.toISOString());
  revalidatePath("/", "layout");
  return { ok: "Punched in" };
}

export async function punchOutAction(): Promise<FormState> {
  const user = await requireUser();
  const now = new Date();
  const date = todayStr(now);
  const today = await getAttendance(user.id, date);
  if (!today) return { error: "Punch in first" };
  if (today.punch_out) return { error: "You have already punched out today" };
  await punchOut(user.id, date, now.toISOString());
  await clearLocation(user.id);
  revalidatePath("/", "layout");
  return { ok: "Punched out" };
}

/** The employee's phone reports its position while punched in (only when the admin switched tracking on). */
export async function reportLocationAction(lat: number, lng: number, baseLat: number, baseLng: number, accuracy: number) {
  const user = await requireUser();
  if (user.track_location === 0) return;
  const valid = [lat, lng, baseLat, baseLng].every(Number.isFinite) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  if (!valid) return;
  const today = await getAttendance(user.id, todayStr());
  if (!today || today.punch_out) return;
  await saveLocation({
    employee_id: user.id, date: today.date, lat, lng, base_lat: baseLat, base_lng: baseLng,
    distance_m: Math.round(distanceMeters(baseLat, baseLng, lat, lng)),
    accuracy_m: Math.round(Number.isFinite(accuracy) ? accuracy : 0),
    at: new Date().toISOString(),
  });
}

/** Undo a punch-out for today: keeps the original punch-in and reopens the day. */
export async function punchAgainAction(): Promise<FormState> {
  const user = await requireUser();
  const date = todayStr(new Date());
  const today = await getAttendance(user.id, date);
  if (!today) return { error: "Punch in first" };
  if (!today.punch_out) return { error: "You are already punched in" };
  await upsertAttendance(user.id, date, today.punch_in, null, today.note);
  revalidatePath("/", "layout");
  return { ok: "Punched in again" };
}

/** Admin punches an employee in/out (or reopens their day) for today, at the current time. */
export async function adminPunchAction(employeeId: number, kind: "in" | "out" | "again"): Promise<FormState> {
  await requireAdmin();
  if (!(await getEmployee(employeeId))) return { error: "Employee not found" };
  const now = new Date();
  const date = todayStr(now);
  const today = await getAttendance(employeeId, date);

  if (kind === "in") {
    if (today) return { error: "Already punched in today" };
    await punchIn(employeeId, date, now.toISOString());
  } else if (kind === "out") {
    if (!today) return { error: "Not punched in yet" };
    if (today.punch_out) return { error: "Already punched out today" };
    await punchOut(employeeId, date, now.toISOString());
  } else {
    if (!today?.punch_out) return { error: "Nothing to reopen" };
    await upsertAttendance(employeeId, date, today.punch_in, null, today.note);
  }
  revalidatePath("/", "layout");
  return { ok: "Done" };
}

/* ---------- employees (admin) ---------- */

function parseEmployee(fd: FormData) {
  const email = str(fd, "email").toLowerCase();
  const phone = normalizePhone(str(fd, "phone"));
  const basic = num(fd, "basic");
  const hra = num(fd, "hra");
  const conveyance = num(fd, "conveyance");
  const medical = num(fd, "medical");
  const special = num(fd, "special");
  const professionalTax = num(fd, "professional_tax");
  const esi = num(fd, "esi");
  const tds = num(fd, "tds");
  const role = str(fd, "role") === "ADMIN" ? "ADMIN" : "EMPLOYEE";
  const joinDate = str(fd, "join_date");
  const error =
    !str(fd, "name") ? "Name is required"
    : !/^\S+@\S+\.\S+$/.test(email) ? "Enter a valid email"
    : !phone ? "Enter a valid 10-digit mobile number (used for login)"
    : !isValidDate(joinDate) ? "Enter a valid joining date"
    : [basic, hra, conveyance, medical, special, professionalTax, esi, tds].some(Number.isNaN) ? "Salary amounts must be positive numbers"
    : null;
  return {
    error,
    data: {
      emp_code: str(fd, "emp_code"),
      name: str(fd, "name"),
      email,
      phone: phone ?? "",
      role: role as "ADMIN" | "EMPLOYEE",
      designation: str(fd, "designation"),
      department: str(fd, "department"),
      join_date: joinDate,
      pan: str(fd, "pan").toUpperCase(),
      uan: str(fd, "uan"),
      bank_name: str(fd, "bank_name"),
      bank_account: str(fd, "bank_account"),
      basic, hra, conveyance, medical, special,
      professional_tax: professionalTax, esi, tds,
      pf_enabled: fd.get("pf_enabled") ? 1 : 0,
      ot_enabled: fd.get("ot_enabled") ? 1 : 0,
      track_location: fd.get("track_location") ? 1 : 0,
      active: fd.get("active") ? 1 : 0,
    },
  };
}

/** A department/designation typed via "Add new" on the employee form joins the dropdown lists. */
async function rememberOrgNames(department: string, designation: string) {
  if (department) await addDepartment(department);
  if (designation) await addDesignation(designation);
}

export async function createEmployeeAction(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const { error, data } = parseEmployee(fd);
  if (error) return { error };
  if (await getEmployeeByPhone(data.phone)) return { error: "An employee with this mobile number already exists" };
  if (await getEmployeeByEmail(data.email)) return { error: "An employee with this email already exists" };
  await insertEmployee(data);
  await rememberOrgNames(data.department, data.designation);
  revalidatePath("/employees");
  redirect("/employees");
}

export async function updateEmployeeAction(id: number, _prev: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const existing = await getEmployee(id);
  if (!existing) return { error: "Employee not found" };
  const { error, data } = parseEmployee(fd);
  if (error) return { error };
  const clash = await getEmployeeByEmail(data.email);
  if (clash && clash.id !== id) return { error: "Another employee already uses this email" };
  const phoneClash = await getEmployeeByPhone(data.phone);
  if (phoneClash && phoneClash.id !== id) return { error: "Another employee already uses this mobile number" };
  if (id === admin.id && (data.role !== "ADMIN" || !data.active)) {
    return { error: "You can't remove your own admin access or deactivate yourself" };
  }
  await updateEmployee(id, { ...data, emp_code: existing.emp_code });
  await rememberOrgNames(data.department, data.designation);
  revalidatePath("/employees");
  redirect("/employees");
}

/* ---------- attendance correction (admin) ---------- */

export async function saveAttendanceAction(employeeId: number, date: string, _prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  if (!(await getEmployee(employeeId)) || !isValidDate(date)) return { error: "Invalid employee or date" };
  const back = `/attendance?emp=${employeeId}&month=${date.slice(0, 7)}`;

  if (fd.get("intent") === "delete") {
    await deleteAttendance(employeeId, date);
    revalidatePath("/attendance");
    redirect(back);
  }

  const inLocal = str(fd, "punch_in");
  const outLocal = str(fd, "punch_out");
  if (!inLocal) return { error: "Punch-in time is required" };
  const inIso = istLocalToIso(inLocal);
  const outIso = outLocal ? istLocalToIso(outLocal) : null;
  if (outIso && Date.parse(outIso) <= Date.parse(inIso)) return { error: "Punch-out must be after punch-in" };
  await upsertAttendance(employeeId, date, inIso, outIso, str(fd, "note"));
  revalidatePath("/attendance");
  redirect(back);
}

/* ---------- payroll (admin) ---------- */

export async function generatePayslipsAction(fd: FormData) {
  await requireAdmin();
  const month = str(fd, "month");
  if (!isValidMonth(month)) return;
  const only = Number(str(fd, "employee_id")) || null;
  const today = todayStr();
  for (const emp of await listEmployees({ activeOnly: true })) {
    if (only && emp.id !== only) continue;
    if (emp.join_date.slice(0, 7) > month) continue;
    const salary = await getMonthSalary(emp, month, today);
    await savePayslip(salaryToPayslip(emp, month, salary));
  }
  revalidatePath("/payroll");
  revalidatePath("/payslips");
}

/** Admin emails a salary slip (PDF attached) to the given address. */
export async function emailPayslipAction(id: number, _prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const to = str(fd, "to");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return { error: "Enter a valid email address" };
  if (!mailConfigured()) return { error: "Email isn't set up. Add SMTP_HOST, SMTP_USER and SMTP_PASS to .env.local and restart." };
  const slip = await getPayslip(id);
  if (!slip) return { error: "Salary slip not found" };
  const { bytes, fileName } = await buildSlipPdf(slip, await getEmployee(slip.employee_id));
  const note = str(fd, "message");
  try {
    await sendMail({
      to,
      subject: `Salary slip - ${slip.month}`,
      text: [`Hello ${slip.emp_name},`, note, `Please find your salary slip for ${slip.month} attached.`, `Regards,\n${COMPANY.name}`]
        .filter(Boolean).join("\n\n"),
      attachments: [{ filename: fileName, content: Buffer.from(bytes) }],
    });
  } catch (e) {
    return { error: `Could not send email: ${e instanceof Error ? e.message : "unknown error"}` };
  }
  return { ok: `Salary slip sent to ${to}` };
}

/** Admin edits a generated slip; totals are recomputed here so they always add up. Re-generating the month overwrites edits. */
export async function updatePayslipAction(id: number, _prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const stored = await getPayslip(id);
  if (!stored) return { error: "Salary slip not found" };
  const slip = withSlipDefaults(stored);

  const n = (key: string) => {
    const v = num(fd, key);
    return Number.isNaN(v) ? null : Math.round(v * 100) / 100;
  };
  const keys = [
    "basic", "hra", "conveyance", "medical", "special", "overtime_hours", "overtime_pay", "lop_deduction", "pf",
    "professional_tax", "esi", "tds", "present_days", "weekly_offs", "leave_taken", "paid_leave_days", "lop_days",
    "paid_days", "per_day",
  ] as const;
  const values = {} as Record<(typeof keys)[number], number>;
  for (const k of keys) {
    const v = n(k);
    if (v === null) return { error: "Amounts and days must be valid numbers (0 or more)" };
    values[k] = v;
  }
  const emp_name = str(fd, "emp_name");
  if (!emp_name) return { error: "Employee name can't be empty" };

  const gross = Math.round((values.basic + values.hra + values.conveyance + values.medical + values.special) * 100) / 100;
  const totalDeductions = values.lop_deduction + values.pf + values.professional_tax + values.esi + values.tds;
  const computedNet = Math.round((gross + values.overtime_pay - totalDeductions) * 100) / 100;
  // Admin may override the net pay; blank falls back to the computed total.
  const netRaw = str(fd, "net");
  const net = netRaw === "" ? computedNet : Math.round(Number(netRaw) * 100) / 100;
  if (!Number.isFinite(net)) return { error: "Net pay must be a valid number" };

  const { id: _id, ...rest } = slip;
  await savePayslip({
    ...rest,
    ...values,
    emp_name,
    emp_code: str(fd, "emp_code"),
    designation: str(fd, "designation"),
    department: str(fd, "department"),
    pan: str(fd, "pan"),
    uan: str(fd, "uan"),
    bank_name: str(fd, "bank_name"),
    bank_account: str(fd, "bank_account"),
    gross,
    net,
    net_words: str(fd, "net_words"),
  });
  revalidatePath("/payslips");
  redirect(`/payslips/${id}`);
}

/* ---------- leave ---------- */

export async function applyLeaveAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const type = str(fd, "type") as LeaveType;
  const start = parseDmy(str(fd, "start_date"));
  const end = str(fd, "end_date") ? parseDmy(str(fd, "end_date")) : start;
  const halfDay = fd.get("half_day") ? 1 : 0;
  if (!(type in LEAVE_TYPE_LABELS)) return { error: "Choose a leave type" };
  if (!isValidDate(start) || !isValidDate(end)) return { error: "Enter dates as DD-MM-YYYY, e.g. 01-10-2026" };
  if (halfDay && start !== end) return { error: "Half-day leave must be a single day" };

  const days = countLeaveDays(start, end, await holidaysBetween(start, end), !!halfDay);
  const error = await validateLeave({ employeeId: user.id, type, start, end, days });
  if (error) return { error };

  await insertLeave({ employee_id: user.id, type, start_date: start, end_date: end, half_day: halfDay, days, reason: str(fd, "reason") });
  revalidatePath("/leaves");
  return { ok: `Leave request for ${days} day${days === 1 ? "" : "s"} sent for approval` };
}

export async function cancelLeaveAction(fd: FormData) {
  const user = await requireUser();
  const leave = await getLeave(Number(str(fd, "id")));
  if (!leave || leave.employee_id !== user.id || leave.status !== "PENDING") return;
  await setLeaveStatus(leave.id, "CANCELLED");
  revalidatePath("/leaves");
}

export async function decideLeaveAction(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const leave = await getLeave(Number(str(fd, "id")));
  const decision = str(fd, "decision");
  if (!leave || (leave.status !== "PENDING" && leave.status !== "APPROVED")) return { error: "This request can no longer be changed" };
  if (decision === "APPROVED") {
    if (leave.status === "APPROVED") return {};
    // Re-check: balance or overlapping leave may have changed since the request was made.
    const error = await validateLeave({
      employeeId: leave.employee_id, type: leave.type, start: leave.start_date, end: leave.end_date,
      days: leave.days, excludeId: leave.id,
    });
    if (error) return { error };
    await setLeaveStatus(leave.id, "APPROVED", str(fd, "admin_note"));
  } else if (decision === "REJECTED") {
    await setLeaveStatus(leave.id, "REJECTED", str(fd, "admin_note"));
  } else {
    return { error: "Invalid decision" };
  }
  revalidatePath("/leaves");
  revalidatePath("/attendance");
  return {};
}

/* ---------- holidays (admin) ---------- */

export async function addHolidayAction(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const date = str(fd, "date");
  const name = str(fd, "name");
  if (!isValidDate(date)) return { error: "Choose a valid date" };
  if (!name) return { error: "Holiday name is required" };
  await addHoliday(date, name);
  revalidatePath("/holidays");
  return { ok: "Holiday saved" };
}

export async function deleteHolidayAction(fd: FormData) {
  await requireAdmin();
  const date = str(fd, "date");
  if (isValidDate(date)) await deleteHoliday(date);
  revalidatePath("/holidays");
}
