import fs from "node:fs";
import path from "node:path";
import { SEED_DEPARTMENTS, SEED_DESIGNATIONS, SEED_EMPLOYEES, SEED_HOLIDAYS } from "./seed-data";
import type { Attendance, Employee, Holiday, LeaveRequest, LeaveStatus, LeaveType, Payslip, Regularization, LocationPing } from "./types";

/**
 * In-memory store used while no MONGODB_URI is set ("static mode"). Same functions as queries.mongo.ts,
 * so switching to MongoDB later needs no other code changes. Data resets when the server restarts.
 */
type LeaveDoc = Omit<LeaveRequest, "emp_name" | "emp_code">;
export type RegDoc = Omit<Regularization, "emp_name" | "emp_code">;
type Store = {
  employees: Employee[];
  attendance: Attendance[];
  payslips: Payslip[];
  holidays: Holiday[];
  leaves: LeaveDoc[];
  departments: string[];
  designations: string[];
  regs: RegDoc[];
  locations?: LocationPing[];
  seq: Record<string, number>;
};

const g = globalThis as unknown as { __memStore?: Store };

/**
 * Static-mode data lives in memory but is mirrored to a JSON file, so it survives dev-server reloads and
 * restarts. Override the location with STATIC_DATA_FILE.
 */
const DATA_FILE = process.env.STATIC_DATA_FILE ?? path.join(process.cwd(), "data", "static-data.json");

function load(): Store | null {
  try {
    const saved = JSON.parse(fs.readFileSync(DATA_FILE, "utf8")) as Store;
    return Array.isArray(saved?.employees) && saved.employees.length > 0 ? saved : null;
  } catch {
    return null; // no file yet, or unreadable: start from the demo data
  }
}

/** Write the store to disk. Call after every change. */
export function save() {
  try {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    const tmp = DATA_FILE + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(store()));
    fs.renameSync(tmp, DATA_FILE);
  } catch (e) {
    console.error("[static data] could not save:", e);
  }
}

/** Shared with extras.memory.ts */
export function store(): Store {
  g.__memStore ??= load() ?? {
    employees: structuredClone(SEED_EMPLOYEES),
    attendance: [],
    payslips: [],
    holidays: structuredClone(SEED_HOLIDAYS),
    leaves: [],
    departments: [...SEED_DEPARTMENTS],
    designations: [...SEED_DESIGNATIONS],
    regs: [],
    seq: { employees: SEED_EMPLOYEES.length },
  };
  return g.__memStore;
}

export const nextId = (name: string) => (store().seq[name] = (store().seq[name] ?? 0) + 1);
export const copy = <T>(v: T): T => structuredClone(v);
const empCode = (id: number) => `PMC/${String(new Date().getFullYear()).slice(2)}/${String(id).padStart(2, "0")}`;

/* ---------- employees ---------- */

export async function getEmployee(id: number) {
  return copy(store().employees.find((e) => e.id === id) ?? null);
}

export async function getEmployeeByEmail(email: string) {
  return copy(store().employees.find((e) => e.email === email.toLowerCase()) ?? null);
}

export async function getEmployeeByPhone(phone: string) {
  return copy(store().employees.find((e) => e.phone === phone) ?? null);
}

export async function listEmployees(opts: { activeOnly?: boolean } = {}) {
  return copy(
    store().employees.filter((e) => !opts.activeOnly || e.active).sort((a, b) => a.emp_code.localeCompare(b.emp_code)),
  );
}

export type EmployeeInput = Omit<Employee, "id">;

export async function insertEmployee(e: EmployeeInput) {
  const id = nextId("employees");
  store().employees.push({ ...e, id, emp_code: e.emp_code || empCode(id) });
  save();
}

export async function updateEmployee(id: number, e: EmployeeInput) {
  const s = store();
  s.employees = s.employees.map((x) => (x.id === id ? { ...x, ...e } : x));
  save();
}

/* ---------- attendance ---------- */

export async function getAttendance(employeeId: number, date: string) {
  return copy(store().attendance.find((a) => a.employee_id === employeeId && a.date === date) ?? null);
}

export async function listAttendanceForMonth(employeeId: number, month: string) {
  return copy(
    store()
      .attendance.filter((a) => a.employee_id === employeeId && a.date.startsWith(month + "-"))
      .sort((a, b) => a.date.localeCompare(b.date)),
  );
}

export async function listAttendanceForDate(date: string) {
  return copy(store().attendance.filter((a) => a.date === date));
}

export async function punchIn(employeeId: number, date: string, iso: string) {
  store().attendance.push({ id: nextId("attendance"), employee_id: employeeId, date, punch_in: iso, punch_out: null, note: "" });
  save();
}

export async function punchOut(employeeId: number, date: string, iso: string) {
  const row = store().attendance.find((a) => a.employee_id === employeeId && a.date === date);
  if (row) row.punch_out = iso;
  save();
}

export async function upsertAttendance(employeeId: number, date: string, inIso: string, outIso: string | null, note: string) {
  const row = store().attendance.find((a) => a.employee_id === employeeId && a.date === date);
  if (row) Object.assign(row, { punch_in: inIso, punch_out: outIso, note });
  else store().attendance.push({ id: nextId("attendance"), employee_id: employeeId, date, punch_in: inIso, punch_out: outIso, note });
  save();
}

export async function deleteAttendance(employeeId: number, date: string) {
  const s = store();
  s.attendance = s.attendance.filter((a) => !(a.employee_id === employeeId && a.date === date));
  save();
}

/* ---------- payslips ---------- */

export async function getPayslip(id: number) {
  return copy(store().payslips.find((p) => p.id === id) ?? null);
}

export async function listPayslips(opts: { employeeId?: number; month?: string } = {}) {
  return copy(
    store()
      .payslips.filter((p) => (!opts.employeeId || p.employee_id === opts.employeeId) && (!opts.month || p.month === opts.month))
      .sort((a, b) => b.month.localeCompare(a.month) || a.emp_code.localeCompare(b.emp_code)),
  );
}

export async function savePayslip(p: Omit<Payslip, "id">) {
  const row = store().payslips.find((x) => x.employee_id === p.employee_id && x.month === p.month);
  if (row) Object.assign(row, p);
  else store().payslips.push({ ...p, id: nextId("payslips") });
  save();
}

/* ---------- holidays ---------- */

export async function listHolidays(year: number) {
  return copy(store().holidays.filter((h) => h.date.startsWith(`${year}-`)).sort((a, b) => a.date.localeCompare(b.date)));
}

export async function holidaysBetween(start: string, end: string): Promise<Set<string>> {
  return new Set(store().holidays.filter((h) => h.date >= start && h.date <= end).map((h) => h.date));
}

export async function addHoliday(date: string, name: string) {
  const row = store().holidays.find((h) => h.date === date);
  if (row) row.name = name;
  else store().holidays.push({ date, name });
  save();
}

export async function deleteHoliday(date: string) {
  const s = store();
  s.holidays = s.holidays.filter((h) => h.date !== date);
  save();
}

/* ---------- leave ---------- */

function withEmployee(leaves: LeaveDoc[]): LeaveRequest[] {
  const byId = new Map(store().employees.map((e) => [e.id, e]));
  return copy(leaves).map((l) => ({
    ...l,
    emp_name: byId.get(l.employee_id)?.name ?? "",
    emp_code: byId.get(l.employee_id)?.emp_code ?? "",
  }));
}

export async function getLeave(id: number) {
  const leave = store().leaves.find((l) => l.id === id);
  return leave ? withEmployee([leave])[0] : null;
}

export async function listLeaves(opts: { employeeId?: number; status?: LeaveStatus } = {}) {
  const rows = store()
    .leaves.filter((l) => (!opts.employeeId || l.employee_id === opts.employeeId) && (!opts.status || l.status === opts.status))
    .sort((a, b) => b.start_date.localeCompare(a.start_date) || b.id - a.id);
  return withEmployee(rows);
}

export async function listLeavesOverlapping(employeeId: number, start: string, end: string, statuses: LeaveStatus[]) {
  return withEmployee(
    store().leaves.filter(
      (l) => l.employee_id === employeeId && l.start_date <= end && l.end_date >= start && statuses.includes(l.status),
    ),
  );
}

export async function leaveDaysUsed(employeeId: number, type: LeaveType, year: number, statuses: LeaveStatus[], excludeId = 0) {
  return store()
    .leaves.filter(
      (l) =>
        l.employee_id === employeeId && l.type === type && l.id !== excludeId && statuses.includes(l.status) &&
        l.start_date >= `${year}-01-01` && l.start_date <= `${year}-12-31`,
    )
    .reduce((sum, l) => sum + l.days, 0);
}

export async function insertLeave(l: {
  employee_id: number; type: LeaveType; start_date: string; end_date: string; half_day: number; days: number; reason: string;
}) {
  store().leaves.push({
    ...l, id: nextId("leave_requests"), status: "PENDING", applied_at: new Date().toISOString(), decided_at: null, admin_note: "",
  });
  save();
}

export async function setLeaveStatus(id: number, status: LeaveStatus, adminNote = "") {
  const row = store().leaves.find((l) => l.id === id);
  if (row) Object.assign(row, { status, decided_at: new Date().toISOString(), admin_note: adminNote });
  save();
}

export async function countPendingLeaves() {
  return store().leaves.filter((l) => l.status === "PENDING").length;
}
