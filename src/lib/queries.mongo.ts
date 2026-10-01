import { getDb, nextId } from "./db";
import type { Attendance, Employee, Holiday, LeaveRequest, LeaveStatus, LeaveType, Payslip } from "./types";

const NO_ID = { projection: { _id: 0 } } as const;

async function col<T extends object>(name: string) {
  return (await getDb()).collection<T>(name);
}

const empCode = (id: number) => `PMC/${String(new Date().getFullYear()).slice(2)}/${String(id).padStart(2, "0")}`;

/* ---------- employees ---------- */

export async function getEmployee(id: number) {
  return (await col<Employee>("employees")).findOne({ id }, NO_ID) as Promise<Employee | null>;
}

export async function getEmployeeByEmail(email: string) {
  return (await col<Employee>("employees")).findOne({ email: email.toLowerCase() }, NO_ID) as Promise<Employee | null>;
}

export async function getEmployeeByPhone(phone: string) {
  return (await col<Employee>("employees")).findOne({ phone }, NO_ID) as Promise<Employee | null>;
}

export async function listEmployees(opts: { activeOnly?: boolean } = {}) {
  return (await col<Employee>("employees"))
    .find(opts.activeOnly ? { active: 1 } : {}, NO_ID)
    .sort({ emp_code: 1 })
    .toArray() as Promise<Employee[]>;
}

export type EmployeeInput = Omit<Employee, "id">;

/** An empty emp_code becomes PMC/YY/NN from the new id. */
export async function insertEmployee(e: EmployeeInput) {
  const id = await nextId("employees");
  await (await col<Employee>("employees")).insertOne({ ...e, id, emp_code: e.emp_code || empCode(id) });
}

export async function updateEmployee(id: number, e: EmployeeInput) {
  await (await col<Employee>("employees")).updateOne({ id }, { $set: e });
}

/* ---------- attendance ---------- */

export async function getAttendance(employeeId: number, date: string) {
  return (await col<Attendance>("attendance")).findOne({ employee_id: employeeId, date }, NO_ID) as Promise<Attendance | null>;
}

export async function listAttendanceForMonth(employeeId: number, month: string) {
  return (await col<Attendance>("attendance"))
    .find({ employee_id: employeeId, date: { $gte: `${month}-01`, $lte: `${month}-31` } }, NO_ID)
    .sort({ date: 1 })
    .toArray() as Promise<Attendance[]>;
}

export async function listAttendanceForDate(date: string) {
  return (await col<Attendance>("attendance")).find({ date }, NO_ID).toArray() as Promise<Attendance[]>;
}

export async function punchIn(employeeId: number, date: string, iso: string) {
  const id = await nextId("attendance");
  await (await col<Attendance>("attendance")).insertOne({
    id, employee_id: employeeId, date, punch_in: iso, punch_out: null, note: "",
  });
}

export async function punchOut(employeeId: number, date: string, iso: string) {
  await (await col<Attendance>("attendance")).updateOne({ employee_id: employeeId, date }, { $set: { punch_out: iso } });
}

export async function upsertAttendance(employeeId: number, date: string, inIso: string, outIso: string | null, note: string) {
  const attendance = await col<Attendance>("attendance");
  const existing = await attendance.findOne({ employee_id: employeeId, date }, NO_ID);
  await attendance.updateOne(
    { employee_id: employeeId, date },
    { $set: { punch_in: inIso, punch_out: outIso, note }, $setOnInsert: { id: existing?.id ?? (await nextId("attendance")) } },
    { upsert: true },
  );
}

export async function deleteAttendance(employeeId: number, date: string) {
  await (await col<Attendance>("attendance")).deleteOne({ employee_id: employeeId, date });
}

/* ---------- payslips ---------- */

export async function getPayslip(id: number) {
  return (await col<Payslip>("payslips")).findOne({ id }, NO_ID) as Promise<Payslip | null>;
}

export async function listPayslips(opts: { employeeId?: number; month?: string } = {}) {
  const filter: Record<string, unknown> = {};
  if (opts.employeeId) filter.employee_id = opts.employeeId;
  if (opts.month) filter.month = opts.month;
  return (await col<Payslip>("payslips"))
    .find(filter, NO_ID)
    .sort({ month: -1, emp_code: 1 })
    .toArray() as Promise<Payslip[]>;
}

export async function savePayslip(p: Omit<Payslip, "id">) {
  const payslips = await col<Payslip>("payslips");
  const existing = await payslips.findOne({ employee_id: p.employee_id, month: p.month }, NO_ID);
  await payslips.updateOne(
    { employee_id: p.employee_id, month: p.month },
    { $set: p, $setOnInsert: { id: existing?.id ?? (await nextId("payslips")) } },
    { upsert: true },
  );
}

/* ---------- holidays ---------- */

export async function listHolidays(year: number) {
  return (await col<Holiday>("holidays"))
    .find({ date: { $gte: `${year}-01-01`, $lte: `${year}-12-31` } }, NO_ID)
    .sort({ date: 1 })
    .toArray() as Promise<Holiday[]>;
}

export async function holidaysBetween(start: string, end: string): Promise<Set<string>> {
  const rows = await (await col<Holiday>("holidays")).find({ date: { $gte: start, $lte: end } }, NO_ID).toArray();
  return new Set(rows.map((r) => r.date));
}

export async function addHoliday(date: string, name: string) {
  await (await col<Holiday>("holidays")).updateOne({ date }, { $set: { name } }, { upsert: true });
}

export async function deleteHoliday(date: string) {
  await (await col<Holiday>("holidays")).deleteOne({ date });
}

/* ---------- leave ---------- */

type LeaveDoc = Omit<LeaveRequest, "emp_name" | "emp_code">;

/** Attaches the employee's current name/code to each leave. */
async function withEmployee(leaves: LeaveDoc[]): Promise<LeaveRequest[]> {
  if (leaves.length === 0) return [];
  const ids = [...new Set(leaves.map((l) => l.employee_id))];
  const emps = await (await col<Employee>("employees")).find({ id: { $in: ids } }, NO_ID).toArray();
  const byId = new Map(emps.map((e) => [e.id, e]));
  return leaves.map((l) => ({
    ...l,
    emp_name: byId.get(l.employee_id)?.name ?? "",
    emp_code: byId.get(l.employee_id)?.emp_code ?? "",
  }));
}

export async function getLeave(id: number) {
  const leave = (await (await col<LeaveDoc>("leave_requests")).findOne({ id }, NO_ID)) as LeaveDoc | null;
  return leave ? (await withEmployee([leave]))[0] : null;
}

export async function listLeaves(opts: { employeeId?: number; status?: LeaveStatus } = {}) {
  const filter: Record<string, unknown> = {};
  if (opts.employeeId) filter.employee_id = opts.employeeId;
  if (opts.status) filter.status = opts.status;
  const leaves = (await (await col<LeaveDoc>("leave_requests"))
    .find(filter, NO_ID)
    .sort({ start_date: -1, id: -1 })
    .toArray()) as LeaveDoc[];
  return withEmployee(leaves);
}

/** Leaves that touch [start, end] with one of the given statuses. */
export async function listLeavesOverlapping(employeeId: number, start: string, end: string, statuses: LeaveStatus[]) {
  const leaves = (await (await col<LeaveDoc>("leave_requests"))
    .find({ employee_id: employeeId, start_date: { $lte: end }, end_date: { $gte: start }, status: { $in: statuses } }, NO_ID)
    .toArray()) as LeaveDoc[];
  return withEmployee(leaves);
}

/** Days already taken/requested of a leave type in a calendar year (leaves are limited to one year). */
export async function leaveDaysUsed(employeeId: number, type: LeaveType, year: number, statuses: LeaveStatus[], excludeId = 0) {
  const rows = await (await col<LeaveDoc>("leave_requests"))
    .aggregate<{ total: number }>([
      {
        $match: {
          employee_id: employeeId, type, status: { $in: statuses }, id: { $ne: excludeId },
          start_date: { $gte: `${year}-01-01`, $lte: `${year}-12-31` },
        },
      },
      { $group: { _id: null, total: { $sum: "$days" } } },
    ])
    .toArray();
  return rows[0]?.total ?? 0;
}

export async function insertLeave(l: {
  employee_id: number; type: LeaveType; start_date: string; end_date: string; half_day: number; days: number; reason: string;
}) {
  const id = await nextId("leave_requests");
  await (await col<LeaveDoc>("leave_requests")).insertOne({
    ...l, id, status: "PENDING", applied_at: new Date().toISOString(), decided_at: null, admin_note: "",
  });
}

export async function setLeaveStatus(id: number, status: LeaveStatus, adminNote = "") {
  await (await col<LeaveDoc>("leave_requests")).updateOne(
    { id },
    { $set: { status, decided_at: new Date().toISOString(), admin_note: adminNote } },
  );
}

export async function countPendingLeaves() {
  return (await col<LeaveDoc>("leave_requests")).countDocuments({ status: "PENDING" });
}
