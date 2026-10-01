import { copy, nextId, save, store, type RegDoc } from "./queries.memory";
import { SEED_DEPARTMENTS, SEED_DESIGNATIONS } from "./seed-data";
import type { LocationPing, RegStatus, Regularization } from "./types";

/** Departments, designations and attendance-correction requests for the in-memory store. */

// A dev server that hot-reloaded before these lists existed may hold an older store shape.
function lists() {
  const s = store();
  s.departments ??= [...SEED_DEPARTMENTS];
  s.designations ??= [...SEED_DESIGNATIONS];
  s.regs ??= [];
  return s;
}

const byName = (a: string, b: string) => a.localeCompare(b);

/* ---------- departments & designations ---------- */

export async function listDepartments() {
  return [...lists().departments].sort(byName);
}

export async function addDepartment(name: string) {
  const s = lists();
  if (name && !s.departments.some((d) => d.toLowerCase() === name.toLowerCase())) s.departments.push(name);
  save();
}

export async function deleteDepartment(name: string) {
  const s = lists();
  s.departments = s.departments.filter((d) => d !== name);
  save();
}

export async function listDesignations() {
  return [...lists().designations].sort(byName);
}

export async function addDesignation(name: string) {
  const s = lists();
  if (name && !s.designations.some((d) => d.toLowerCase() === name.toLowerCase())) s.designations.push(name);
  save();
}

export async function deleteDesignation(name: string) {
  const s = lists();
  s.designations = s.designations.filter((d) => d !== name);
  save();
}

/* ---------- attendance correction requests ---------- */

function withEmployee(rows: RegDoc[]): Regularization[] {
  const byId = new Map(store().employees.map((e) => [e.id, e]));
  return copy(rows).map((r) => ({
    ...r,
    emp_name: byId.get(r.employee_id)?.name ?? "",
    emp_code: byId.get(r.employee_id)?.emp_code ?? "",
  }));
}

export async function getRegularization(id: number) {
  const row = lists().regs.find((r) => r.id === id);
  return row ? withEmployee([row])[0] : null;
}

export async function listRegularizations(opts: { employeeId?: number; status?: RegStatus } = {}) {
  const rows = lists()
    .regs.filter((r) => (!opts.employeeId || r.employee_id === opts.employeeId) && (!opts.status || r.status === opts.status))
    .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  return withEmployee(rows);
}

export async function hasPendingRegularization(employeeId: number, date: string) {
  return lists().regs.some((r) => r.employee_id === employeeId && r.date === date && r.status === "PENDING");
}

export async function insertRegularization(r: { employee_id: number; date: string; punch_in: string; punch_out: string | null; reason: string }) {
  lists().regs.push({
    ...r, id: nextId("regularizations"), status: "PENDING", applied_at: new Date().toISOString(), decided_at: null, admin_note: "",
  });
  save();
}

export async function setRegularizationStatus(id: number, status: RegStatus, adminNote = "") {
  const row = lists().regs.find((r) => r.id === id);
  if (row) Object.assign(row, { status, decided_at: new Date().toISOString(), admin_note: adminNote });
  save();
}

export async function countPendingRegularizations() {
  return lists().regs.filter((r) => r.status === "PENDING").length;
}

/* ---------- live location ---------- */

export async function saveLocation(p: LocationPing) {
  const s = lists();
  s.locations = [...(s.locations ?? []).filter((l) => l.employee_id !== p.employee_id), p];
  save();
}

export async function listLocations() {
  return copy(lists().locations ?? []);
}

export async function clearLocation(employeeId: number) {
  const s = lists();
  s.locations = (s.locations ?? []).filter((l) => l.employee_id !== employeeId);
  save();
}
