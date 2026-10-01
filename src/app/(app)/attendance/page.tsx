import Link from "next/link";
import { cancelCorrectionAction, decideCorrectionAction, markDayAction } from "@/app/org-actions";
import { ActionForm } from "@/components/ActionForm";
import { MonthPicker } from "@/components/MonthPicker";
import { StatusBadge } from "@/components/StatusBadge";
import { SubmitButton } from "@/components/SubmitButton";
import { requireUser } from "@/lib/auth";
import { fmtDate, fmtHours, fmtTime, isValidMonth, monthStr, todayStr } from "@/lib/dates";
import { getEmployee, listEmployees, listRegularizations } from "@/lib/queries";
import { getMonthSalary } from "@/lib/salary";
import type { RegStatus, Regularization } from "@/lib/types";

type SP = Promise<Record<string, string | string[] | undefined>>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const STATUS_STYLE: Record<RegStatus, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  APPROVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
  CANCELLED: "bg-gray-100 text-gray-600",
};

export default async function AttendancePage({ searchParams }: { searchParams: SP }) {
  const user = await requireUser();
  const sp = await searchParams;
  const isAdmin = user.role === "ADMIN";
  const today = todayStr();

  const monthParam = first(sp.month);
  const month = isValidMonth(monthParam) ? monthParam : monthStr();
  const empId = isAdmin ? Number(first(sp.emp)) || user.id : user.id;
  const employee = (await getEmployee(empId)) ?? user;
  const viewingSelf = employee.id === user.id;

  const [salary, employees, mine, pending] = await Promise.all([
    getMonthSalary(employee, month, today),
    isAdmin ? listEmployees({ activeOnly: true }) : Promise.resolve([]),
    listRegularizations({ employeeId: user.id }),
    isAdmin ? listRegularizations({ status: "PENDING" }) : Promise.resolve([]),
  ]);
  const hrefFor = (m: string) => `/attendance?month=${m}${isAdmin ? `&emp=${employee.id}` : ""}`;
  const overtime = salary.days.reduce((s, d) => s + d.overtime, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Attendance</h1>
          <p className="text-sm text-muted">{employee.name} · {employee.emp_code}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {isAdmin && (
            <form className="flex items-center gap-2">
              <input type="hidden" name="month" value={month} />
              <select name="emp" defaultValue={employee.id} className="input w-auto" aria-label="Employee">
                {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
              <button className="btn">Show</button>
            </form>
          )}
          <MonthPicker month={month} hrefFor={hrefFor} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Summary label="Full days" value={salary.presentDays} />
        <Summary label="Half days" value={salary.halfDays} />
        <Summary label="Unpaid (LOP) days" value={salary.lopDays} tone={salary.lopDays ? "bad" : undefined} />
        <Summary label="Total hours" value={fmtHours(salary.totalHours)} />
        <Summary label="Paid leave days" value={salary.paidLeaveDays} />
        <Summary label="Holidays" value={salary.holidayCount} />
        <Summary label="Late arrivals" value={salary.lateCount} tone={salary.lateCount ? "warn" : undefined} />
        <Summary label="Overtime" value={fmtHours(overtime)} />
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="table">
          <thead>
            <tr><th>Date</th><th>Punch in</th><th>Punch out</th><th>Hours</th><th>Status</th><th>Note</th><th /></tr>
          </thead>
          <tbody>
            {salary.days.map((d) => {
              const fixable = d.status === "INCOMPLETE" || d.status === "ABSENT";
              return (
                <tr key={d.date} className={d.status === "WEEKLY_OFF" || d.status === "HOLIDAY" ? "bg-gray-50/70" : ""}>
                  <td className="whitespace-nowrap">{fmtDate(d.date)}</td>
                  <td>{fmtTime(d.record?.punch_in)}{d.late && <span className="ml-1 text-xs text-red-600">late by {fmtHours(d.lateMinutes / 60)}</span>}</td>
                  <td>{fmtTime(d.record?.punch_out)}</td>
                  <td>{d.hours ? fmtHours(d.hours) : "—"}{d.overtime > 0 && <span className="ml-1 text-xs text-emerald-700">+{fmtHours(d.overtime)} OT</span>}</td>
                  <td><StatusBadge status={d.status} /></td>
                  <td className="text-muted">{d.record?.note}</td>
                  <td className="whitespace-nowrap text-right">
                    {isAdmin && d.status !== "FUTURE" && (
                      <div className="flex items-center justify-end gap-2">
                        {d.status !== "WEEKLY_OFF" && d.status !== "HOLIDAY" && (
                          <form action={markDayAction} className="flex overflow-hidden rounded-md border border-border text-xs font-medium" aria-label="Mark this day">
                            <input type="hidden" name="emp" value={employee.id} />
                            <input type="hidden" name="date" value={d.date} />
                            <button name="kind" value="full" title="Mark full day" className="px-2 py-1 hover:bg-green-50 hover:text-green-700">Full</button>
                            <button name="kind" value="half" title="Mark half day" className="border-x border-border px-2 py-1 hover:bg-amber-50 hover:text-amber-700">Half</button>
                            <button name="kind" value="absent" title="Mark absent" className="px-2 py-1 hover:bg-red-50 hover:text-red-700">Absent</button>
                          </form>
                        )}
                        <Link href={`/attendance/edit?emp=${employee.id}&date=${d.date}`} className="text-sm font-medium text-accent">
                          {d.record ? "Edit" : "Set times"}
                        </Link>
                      </div>
                    )}
                    {!isAdmin && viewingSelf && fixable && d.date <= today && (
                      <Link href={`/attendance/request?date=${d.date}`} className="text-sm font-medium text-accent">Request correction</Link>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">
        Full day ≥ 8h, half day ≥ 4h. A day with a punch-in but no punch-out counts as unpaid until it is corrected.
        Overtime (hours beyond 8, or any hours on an off day) is paid only for employees with overtime enabled.
      </p>

      {isAdmin && (
        <Section title={`Correction requests waiting for you (${pending.length})`}>
          {pending.length === 0 ? (
            <p className="px-5 py-6 text-center text-sm text-muted">No pending requests.</p>
          ) : (
            <Table>
              {pending.map((r) => (
                <tr key={r.id}>
                  <td className="font-medium">{r.emp_name}<span className="block text-xs font-normal text-muted">{r.emp_code}</span></td>
                  <td className="whitespace-nowrap">{fmtDate(r.date)}</td>
                  <td className="whitespace-nowrap">{fmtTime(r.punch_in)} → {fmtTime(r.punch_out)}</td>
                  <td className="max-w-56 text-muted">{r.reason}</td>
                  <td>
                    <ActionForm action={decideCorrectionAction} className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="id" value={r.id} />
                      <input name="admin_note" placeholder="Note (optional)" className="input w-36 py-1" />
                      <SubmitButton name="decision" value="APPROVED" className="btn btn-primary px-3 py-1" pendingText="...">Approve</SubmitButton>
                      <SubmitButton name="decision" value="REJECTED" className="btn px-3 py-1" pendingText="...">Reject</SubmitButton>
                    </ActionForm>
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </Section>
      )}

      {mine.length > 0 && (
        <Section title="My correction requests">
          <Table headings={["Date", "Requested times", "Reason", "Status", ""]}>
            {mine.slice(0, 15).map((r) => <MineRow key={r.id} r={r} />)}
          </Table>
        </Section>
      )}
    </div>
  );
}

function MineRow({ r }: { r: Regularization }) {
  return (
    <tr>
      <td className="whitespace-nowrap">{fmtDate(r.date)}</td>
      <td className="whitespace-nowrap">{fmtTime(r.punch_in)} → {fmtTime(r.punch_out)}</td>
      <td className="max-w-64 text-muted">{r.admin_note || r.reason}</td>
      <td><span className={`badge ${STATUS_STYLE[r.status]}`}>{r.status.charAt(0) + r.status.slice(1).toLowerCase()}</span></td>
      <td className="text-right">
        {r.status === "PENDING" && (
          <form action={cancelCorrectionAction}>
            <input type="hidden" name="id" value={r.id} />
            <button className="text-sm font-medium text-red-600">Cancel</button>
          </form>
        )}
      </td>
    </tr>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card p-0">
      <div className="border-b border-border px-5 py-3.5"><h2 className="font-semibold">{title}</h2></div>
      {children}
    </section>
  );
}

function Table({ headings = ["Employee", "Date", "Requested times", "Reason", "Decision"], children }: { headings?: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="table">
        <thead><tr>{headings.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Summary({ label, value, tone }: { label: string; value: string | number; tone?: "bad" | "warn" }) {
  const color = tone === "bad" ? "text-red-600" : tone === "warn" ? "text-amber-700" : "";
  return (
    <div className="card py-3.5">
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-0.5 text-2xl font-semibold ${color}`}>{value}</p>
    </div>
  );
}
