import { Avatar } from "@/components/Avatar";
import { MonthPicker } from "@/components/MonthPicker";
import { PrintButton } from "@/components/PrintButton";
import { requireAdmin } from "@/lib/auth";
import { fmtHours, isValidMonth, monthLabel, monthStr, todayStr } from "@/lib/dates";
import { listDepartments, listEmployees } from "@/lib/queries";
import { getMonthSalary } from "@/lib/salary";

type SP = Promise<Record<string, string | string[] | undefined>>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function ReportsPage({ searchParams }: { searchParams: SP }) {
  await requireAdmin();
  const sp = await searchParams;
  const m = first(sp.month);
  const month = isValidMonth(m) ? m : monthStr();
  const dept = first(sp.dept);
  const today = todayStr();

  const [everyone, departments] = await Promise.all([listEmployees({ activeOnly: true }), listDepartments()]);
  const employees = everyone.filter((e) => e.join_date.slice(0, 7) <= month && (!dept || e.department === dept));
  const rows = await Promise.all(employees.map(async (e) => ({ e, s: await getMonthSalary(e, month, today) })));

  const sum = (pick: (s: (typeof rows)[number]["s"]) => number) => rows.reduce((t, r) => t + pick(r.s), 0);
  const worked = sum((s) => s.workedDays + s.paidLeaveDays);
  const expected = sum((s) => s.days.filter((d) => d.date <= today && d.status !== "WEEKLY_OFF" && d.status !== "HOLIDAY" && d.status !== "NOT_IN").length);
  const attendancePct = expected ? Math.round((Math.min(worked, expected) / expected) * 100) : 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Monthly report — {monthLabel(month)}</h1>
          <p className="text-sm text-muted">{rows.length} employee{rows.length === 1 ? "" : "s"}{dept ? ` in ${dept}` : ""}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 print:hidden">
          <form className="flex items-center gap-2">
            <input type="hidden" name="month" value={month} />
            <select name="dept" defaultValue={dept} className="input w-auto" aria-label="Department">
              <option value="">All departments</option>
              {departments.map((d) => <option key={d}>{d}</option>)}
            </select>
            <button className="btn">Apply</button>
          </form>
          <MonthPicker month={month} hrefFor={(x) => `/reports?month=${x}${dept ? `&dept=${encodeURIComponent(dept)}` : ""}`} />
          <PrintButton />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Attendance" value={`${attendancePct}%`} hint="present + paid leave" />
        <Stat label="Unpaid (LOP) days" value={sum((s) => s.lopDays)} />
        <Stat label="Late arrivals" value={sum((s) => s.lateCount)} />
        <Stat label="Overtime" value={fmtHours(sum((s) => s.overtimeHours))} />
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="table">
          <thead>
            <tr>
              <th>Employee</th><th className="text-right">Full days</th><th className="text-right">Half days</th>
              <th className="text-right">Paid leave</th><th className="text-right">LOP</th><th className="text-right">Late</th>
              <th className="text-right">Hours</th><th className="text-right">OT</th><th className="text-right">Payable</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={9} className="py-10 text-center text-muted">No employees for this selection.</td></tr>}
            {rows.map(({ e, s }) => (
              <tr key={e.id}>
                <td>
                  <span className="flex items-center gap-3">
                    <Avatar name={e.name} size={28} />
                    <span>
                      <span className="block font-medium">{e.name}</span>
                      <span className="block text-xs text-muted">{e.department || e.emp_code}</span>
                    </span>
                  </span>
                </td>
                <td className="text-right">{s.presentDays}</td>
                <td className="text-right">{s.halfDays}</td>
                <td className="text-right">{s.paidLeaveDays}</td>
                <td className={`text-right ${s.lopDays ? "font-medium text-red-600" : ""}`}>{s.lopDays}</td>
                <td className={`text-right ${s.lateCount ? "text-amber-700" : ""}`}>{s.lateCount}</td>
                <td className="text-right">{fmtHours(s.totalHours)}</td>
                <td className="text-right">{s.overtimeHours ? `${s.overtimeHours} h` : "—"}</td>
                <td className="text-right">{s.paidDays} / {s.calendarDays}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="card py-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}
