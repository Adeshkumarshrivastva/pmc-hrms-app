import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { requireAdmin } from "@/lib/auth";
import { listDepartments, listEmployees } from "@/lib/queries";

type SP = Promise<Record<string, string | string[] | undefined>>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function EmployeesPage({ searchParams }: { searchParams: SP }) {
  await requireAdmin();
  const sp = await searchParams;
  const q = first(sp.q).trim().toLowerCase();
  const dept = first(sp.dept);
  const status = first(sp.status);

  const [all, departments] = await Promise.all([listEmployees(), listDepartments()]);
  const employees = all.filter((e) => {
    if (dept && e.department !== dept) return false;
    if (status === "active" && !e.active) return false;
    if (status === "inactive" && e.active) return false;
    if (!q) return true;
    return [e.name, e.phone, e.email, e.emp_code, e.designation].some((v) => v.toLowerCase().includes(q));
  });
  const filtered = !!(q || dept || status);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Employees</h1>
          <p className="text-sm text-muted">
            {all.filter((e) => e.active).length} active · {all.length} total
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/employees/setup" className="btn">Departments &amp; designations</Link>
          <Link href="/employees/new" className="btn btn-primary">+ Add employee</Link>
        </div>
      </div>

      <form className="card flex flex-wrap items-end gap-3 py-3">
        <div className="min-w-56 flex-1">
          <label className="label" htmlFor="q">Search</label>
          <input id="q" name="q" defaultValue={first(sp.q)} placeholder="Name, mobile, email, code…" className="input" />
        </div>
        <div>
          <label className="label" htmlFor="dept">Department</label>
          <select id="dept" name="dept" defaultValue={dept} className="input">
            <option value="">All</option>
            {departments.map((d) => <option key={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="status">Status</label>
          <select id="status" name="status" defaultValue={status} className="input">
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <button className="btn btn-primary">Filter</button>
        {filtered && <Link href="/employees" className="btn">Clear</Link>}
      </form>

      <div className="card overflow-x-auto p-0">
        <table className="table">
          <thead>
            <tr><th>Employee</th><th>Mobile</th><th>Designation</th><th>Access</th><th>Status</th><th /></tr>
          </thead>
          <tbody>
            {employees.length === 0 && (
              <tr><td colSpan={6} className="py-10 text-center text-muted">{filtered ? "No employees match your filters." : "No employees yet."}</td></tr>
            )}
            {employees.map((e) => (
              <tr key={e.id}>
                <td>
                  <Link href={`/employees/${e.id}`} className="flex items-center gap-3">
                    <Avatar name={e.name} />
                    <span>
                      <span className="block font-medium hover:text-accent">{e.name}</span>
                      <span className="block text-xs text-muted">{e.emp_code} · {e.email}</span>
                    </span>
                  </Link>
                </td>
                <td className="whitespace-nowrap">{e.phone}</td>
                <td>{e.designation || "—"}<span className="block text-xs text-muted">{e.department}</span></td>
                <td>{e.role === "ADMIN" ? <span className="badge bg-emerald-100 text-emerald-800">Admin</span> : "Employee"}</td>
                <td>
                  <span className={`badge ${e.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                    {e.active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="text-right">
                  <Link href={`/employees/${e.id}`} className="text-sm font-medium text-accent">Edit</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
