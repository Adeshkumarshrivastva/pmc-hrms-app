import { getDb, nextId } from "./db";
import type { Employee, LocationPing, RegStatus, Regularization } from "./types";

/** Departments, designations and attendance-correction requests in MongoDB. */

const NO_ID = { projection: { _id: 0 } } as const;

async function col<T extends object>(name: string) {
  return (await getDb()).collection<T>(name);
}

/* ---------- departments & designations ---------- */

type Named = { name: string };

async function names(collection: string) {
  const rows = await (await col<Named>(collection)).find({}, NO_ID).toArray();
  return rows.map((r) => r.name).sort((a, b) => a.localeCompare(b));
}

async function addName(collection: string, name: string) {
  if (!name) return;
  // Case-insensitive de-duplication on top of the unique index
  const existing = await (await col<Named>(collection)).findOne({ name: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" } });
  if (!existing) await (await col<Named>(collection)).updateOne({ name }, { $setOnInsert: { name } }, { upsert: true });
}

export const listDepartments = () => names("departments");
export const addDepartment = (name: string) => addName("departments", name);
export async function deleteDepartment(name: string) {
  await (await col<Named>("departments")).deleteOne({ name });
}

export const listDesignations = () => names("designations");
export const addDesignation = (name: string) => addName("designations", name);
export async function deleteDesignation(name: string) {
  await (await col<Named>("designations")).deleteOne({ name });
}

/* ---------- attendance correction requests ---------- */

type RegDoc = Omit<Regularization, "emp_name" | "emp_code">;

async function withEmployee(rows: RegDoc[]): Promise<Regularization[]> {
  if (rows.length === 0) return [];
  const ids = [...new Set(rows.map((r) => r.employee_id))];
  const emps = await (await col<Employee>("employees")).find({ id: { $in: ids } }, NO_ID).toArray();
  const byId = new Map(emps.map((e) => [e.id, e]));
  return rows.map((r) => ({
    ...r,
    emp_name: byId.get(r.employee_id)?.name ?? "",
    emp_code: byId.get(r.employee_id)?.emp_code ?? "",
  }));
}

export async function getRegularization(id: number) {
  const row = (await (await col<RegDoc>("regularizations")).findOne({ id }, NO_ID)) as RegDoc | null;
  return row ? (await withEmployee([row]))[0] : null;
}

export async function listRegularizations(opts: { employeeId?: number; status?: RegStatus } = {}) {
  const filter: Record<string, unknown> = {};
  if (opts.employeeId) filter.employee_id = opts.employeeId;
  if (opts.status) filter.status = opts.status;
  const rows = (await (await col<RegDoc>("regularizations")).find(filter, NO_ID).sort({ date: -1, id: -1 }).toArray()) as RegDoc[];
  return withEmployee(rows);
}

export async function hasPendingRegularization(employeeId: number, date: string) {
  return (await (await col<RegDoc>("regularizations")).countDocuments({ employee_id: employeeId, date, status: "PENDING" })) > 0;
}

export async function insertRegularization(r: { employee_id: number; date: string; punch_in: string; punch_out: string | null; reason: string }) {
  const id = await nextId("regularizations");
  await (await col<RegDoc>("regularizations")).insertOne({
    ...r, id, status: "PENDING", applied_at: new Date().toISOString(), decided_at: null, admin_note: "",
  });
}

export async function setRegularizationStatus(id: number, status: RegStatus, adminNote = "") {
  await (await col<RegDoc>("regularizations")).updateOne(
    { id },
    { $set: { status, decided_at: new Date().toISOString(), admin_note: adminNote } },
  );
}

export async function countPendingRegularizations() {
  return (await col<RegDoc>("regularizations")).countDocuments({ status: "PENDING" });
}

/* ---------- live location ---------- */

export async function saveLocation(p: LocationPing) {
  await (await col<LocationPing>("locations")).replaceOne({ employee_id: p.employee_id }, p, { upsert: true });
}

export async function listLocations() {
  return (await (await col<LocationPing>("locations")).find({}, NO_ID).toArray()) as LocationPing[];
}

export async function clearLocation(employeeId: number) {
  await (await col<LocationPing>("locations")).deleteOne({ employee_id: employeeId });
}
