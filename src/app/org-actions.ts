"use server";

import { revalidatePath } from "next/cache";
import type { FormState } from "@/app/actions";
import { requireAdmin, requireUser } from "@/lib/auth";
import { RULES } from "@/lib/config";
import { istLocalToIso, isValidDate, todayStr } from "@/lib/dates";
import {
  addDepartment, addDesignation, deleteAttendance, deleteDepartment, deleteDesignation, getEmployee, getRegularization,
  hasPendingRegularization, insertRegularization, listEmployees, setRegularizationStatus, upsertAttendance,
} from "@/lib/queries";

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim().split(/\s+/).join(" ");
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/* ---------- departments & designations (admin) ---------- */

type Kind = "department" | "designation";

export async function addLookupAction(kind: Kind, _prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const name = str(fd, "name");
  if (name.length < 2) return { error: `Enter a ${kind} name` };
  if (name.length > 60) return { error: "Name is too long" };
  await (kind === "department" ? addDepartment(name) : addDesignation(name));
  revalidatePath("/employees", "layout");
  return { ok: `${name} saved` };
}

export async function deleteLookupAction(kind: Kind, fd: FormData) {
  await requireAdmin();
  const name = str(fd, "name");
  // Refuse while employees still use it, so nobody is left with a value missing from the list.
  const inUse = (await listEmployees()).some((e) => (kind === "department" ? e.department : e.designation) === name);
  if (inUse) return;
  await (kind === "department" ? deleteDepartment(name) : deleteDesignation(name));
  revalidatePath("/employees", "layout");
}

/* ---------- attendance correction requests ---------- */

export async function requestCorrectionAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const date = str(fd, "date");
  const inTime = str(fd, "punch_in");
  const outTime = str(fd, "punch_out");
  const today = todayStr();
  if (!isValidDate(date)) return { error: "Choose a valid date" };
  if (date > today) return { error: "You can't request a correction for a future date" };
  if (date < user.join_date) return { error: "That date is before your joining date" };
  if (Date.parse(today) - Date.parse(date) > 45 * 86_400_000) return { error: "Corrections can only be requested for the last 45 days" };
  if (!TIME.test(inTime)) return { error: "Enter your punch-in time" };
  if (outTime && !TIME.test(outTime)) return { error: "Enter a valid punch-out time" };
  if (outTime && outTime <= inTime) return { error: "Punch-out must be after punch-in" };
  if (await hasPendingRegularization(user.id, date)) return { error: "You already have a pending request for this date" };
  const reason = str(fd, "reason");
  if (reason.length < 3) return { error: "Please give a short reason" };

  await insertRegularization({
    employee_id: user.id,
    date,
    punch_in: istLocalToIso(`${date}T${inTime}`),
    punch_out: outTime ? istLocalToIso(`${date}T${outTime}`) : null,
    reason,
  });
  revalidatePath("/attendance");
  return { ok: "Request sent to your admin" };
}

export async function cancelCorrectionAction(fd: FormData) {
  const user = await requireUser();
  const req = await getRegularization(Number(str(fd, "id")));
  if (!req || req.employee_id !== user.id || req.status !== "PENDING") return;
  await setRegularizationStatus(req.id, "CANCELLED");
  revalidatePath("/attendance");
}

export async function decideCorrectionAction(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const req = await getRegularization(Number(str(fd, "id")));
  const decision = str(fd, "decision");
  if (!req || req.status !== "PENDING") return { error: "This request has already been handled" };
  const note = str(fd, "admin_note");
  if (decision === "APPROVED") {
    await upsertAttendance(req.employee_id, req.date, req.punch_in, req.punch_out, `Corrected: ${req.reason}`);
    await setRegularizationStatus(req.id, "APPROVED", note);
  } else if (decision === "REJECTED") {
    await setRegularizationStatus(req.id, "REJECTED", note);
  } else {
    return { error: "Invalid decision" };
  }
  revalidatePath("/attendance");
  revalidatePath("/dashboard");
  return {};
}

/* ---------- quick day marking (admin) ---------- */

const pad2 = (n: number) => String(n).padStart(2, "0");
const addHours = (hhmm: string, hours: number) => {
  const [h, m] = hhmm.split(":").map(Number);
  const total = h * 60 + m + hours * 60;
  return `${pad2(Math.floor(total / 60))}:${pad2(total % 60)}`;
};

/** One-click fix from the attendance table: mark a day as full day, half day or absent. */
export async function markDayAction(fd: FormData) {
  await requireAdmin();
  const employeeId = Number(str(fd, "emp"));
  const date = str(fd, "date");
  const kind = str(fd, "kind");
  if (!(await getEmployee(employeeId)) || !isValidDate(date) || date > todayStr()) return;

  const start = RULES.shiftStart;
  if (kind === "full") {
    await upsertAttendance(employeeId, date, istLocalToIso(`${date}T${start}`), istLocalToIso(`${date}T${addHours(start, RULES.fullDayHours)}`), "Marked present by admin");
  } else if (kind === "half") {
    await upsertAttendance(employeeId, date, istLocalToIso(`${date}T${start}`), istLocalToIso(`${date}T${addHours(start, RULES.halfDayHours)}`), "Marked half day by admin");
  } else if (kind === "absent") {
    if (date === todayStr()) {
      // Today a missing record only reads "Not in yet", so store a zero-hour record to show Absent right away.
      const at = istLocalToIso(`${date}T${start}`);
      await upsertAttendance(employeeId, date, at, at, "Marked absent by admin");
    } else {
      await deleteAttendance(employeeId, date);
    }
  } else {
    return;
  }
  revalidatePath("/attendance");
  revalidatePath("/dashboard");
}
