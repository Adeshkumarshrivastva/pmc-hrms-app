import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { AdminPunchButton } from "@/components/AdminPunchButton";
import { LiveHours } from "@/components/LiveHours";
import { PunchCard } from "@/components/PunchCard";
import { fmtDate, fmtHours, fmtTime, hoursBetween, monthLabel, monthStr, todayStr } from "@/lib/dates";
import { getBalance } from "@/lib/leave";
import { countPendingLeaves, countPendingRegularizations, getAttendance, listAttendanceForDate, listEmployees, listHolidays } from "@/lib/queries";
import { getMonthSalary } from "@/lib/salary";

export default async function DashboardPage() {
  const user = await requireUser();
  const today = todayStr();
  const month = monthStr();

  const todays = await getAttendance(user.id, today);
  const salary = await getMonthSalary(user, month, today);
  const lateDates = salary.days.filter((d) => d.late).map((d) => d.date);
  const lateHint = lateDates.length
    ? `Late on ${lateDates.slice(-3).map((d) => fmtDate(d).split(", ")[1]).join(", ")}${lateDates.length > 3 ? ` +${lateDates.length - 3} more` : ""}`
    : "On time so far";
  const balance = await getBalance(user.id, Number(today.slice(0, 4)));
  const nextHoliday = (await listHolidays(Number(today.slice(0, 4)))).find((h) => h.date >= today);
  const pendingLeaves = user.role === "ADMIN" ? await countPendingLeaves() : 0;
  const pendingCorrections = user.role === "ADMIN" ? await countPendingRegularizations() : 0;

  // Today only: punch in -> punch out (running live while still punched in).
  const liveStartIso = todays && !todays.punch_out ? todays.punch_in : null;
  const todayHours = todays?.punch_out ? fmtHours(hoursBetween(todays.punch_in, todays.punch_out)) : "0h 00m";
  const hoursHint = !todays ? "Not punched in today" : todays.punch_out ? "Punched out" : "In progress";

  const workedLabel = todays
    ? todays.punch_out
      ? fmtHours(hoursBetween(todays.punch_in, todays.punch_out))
      : "In progress"
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Hello, {user.name.split(" ")[0]}</h1>
          <p className="text-sm text-muted">
            {[user.name, user.designation, user.department].filter(Boolean).join(" · ")} — {monthLabel(month)} overview
          </p>
        </div>
        <Link href="/attendance" className="text-sm font-medium text-accent">View full attendance →</Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <PunchCard
            punchInLabel={todays ? fmtTime(todays.punch_in) : null}
            punchOutLabel={todays?.punch_out ? fmtTime(todays.punch_out) : null}
            workedLabel={workedLabel}
            liveStartIso={liveStartIso}
            track={user.track_location !== 0}
          />
        </div>
        <div className="grid grid-cols-2 gap-4 lg:col-span-3">
          <StatCard label="Full days" value={salary.presentDays} />
          <StatCard label="Half days" value={salary.halfDays} />
          <StatCard label="Late arrivals" value={salary.lateCount} hint={lateHint} tone={salary.lateCount ? "warn" : "ok"} />
          <StatCard
            label="Hours worked today"
            value={liveStartIso ? <LiveHours startIso={liveStartIso} /> : todayHours}
            hint={hoursHint}
          />
        </div>
      </div>

      {(pendingLeaves > 0 || pendingCorrections > 0) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {pendingLeaves > 0 && (
            <Link href="/leaves" className="block rounded-lg bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 hover:bg-amber-100">
              {pendingLeaves} leave request{pendingLeaves === 1 ? "" : "s"} waiting for your approval →
            </Link>
          )}
          {pendingCorrections > 0 && (
            <Link href="/attendance" className="block rounded-lg bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 hover:bg-amber-100">
              {pendingCorrections} attendance correction{pendingCorrections === 1 ? "" : "s"} waiting for your approval →
            </Link>
          )}
        </div>
      )}

      <section className="card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Leave balance ({today.slice(0, 4)})</h2>
          <Link href="/leaves" className="text-sm font-medium text-accent">Apply for leave</Link>
        </div>
        <p className="mt-3 text-3xl font-semibold">
          {balance.remaining}<span className="text-base font-normal text-muted"> / {balance.quota} paid leaves left</span>
        </p>
        {nextHoliday && (
          <p className="mt-3 text-sm text-muted">
            Next holiday: <span className="font-medium text-foreground">{nextHoliday.name}</span> · {fmtDate(nextHoliday.date)}
          </p>
        )}
      </section>

      {user.role === "ADMIN" && <TodayOverview date={today} />}
    </div>
  );
}

function StatCard({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: string; tone?: "warn" | "ok" }) {
  return (
    <div className="card flex flex-col justify-center">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-3xl font-semibold">{value}</p>
      {hint && <p className={`mt-1 text-xs ${tone === "warn" ? "text-red-600" : tone === "ok" ? "text-emerald-700" : "text-muted"}`}>{hint}</p>}
    </div>
  );
}

async function TodayOverview({ date }: { date: string }) {
  const employees = await listEmployees({ activeOnly: true });
  const byEmp = new Map((await listAttendanceForDate(date)).map((a) => [a.employee_id, a]));
  const punched = employees.filter((e) => byEmp.has(e.id)).length;
  const working = employees.filter((e) => byEmp.get(e.id) && !byEmp.get(e.id)!.punch_out).length;

  return (
    <section className="card p-0">
      <div className="px-5 py-4">
        <h2 className="font-semibold">Today — all employees</h2>
        <p className="text-sm text-muted">
          {punched} of {employees.length} punched in · {working} still working · {employees.length - punched} not in yet
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="table">
          <thead><tr><th>Employee</th><th>In</th><th>Out</th><th>Status</th><th>Punch</th></tr></thead>
          <tbody>
            {employees.map((e) => {
              const a = byEmp.get(e.id);
              return (
                <tr key={e.id}>
                  <td>
                    <Link href={`/attendance?emp=${e.id}`} className="font-medium hover:text-accent">{e.name}</Link>
                    <span className="ml-2 text-xs text-muted">{e.emp_code}</span>
                  </td>
                  <td>{fmtTime(a?.punch_in)}</td>
                  <td>{fmtTime(a?.punch_out)}</td>
                  <td>
                    {!a ? <span className="badge bg-gray-100 text-gray-600">Not in</span>
                      : !a.punch_out ? <span className="badge bg-blue-100 text-blue-700">Working</span>
                      : <span className="badge bg-green-100 text-green-700">Done</span>}
                  </td>
                  <td><AdminPunchButton employeeId={e.id} state={!a ? "none" : !a.punch_out ? "working" : "done"} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
