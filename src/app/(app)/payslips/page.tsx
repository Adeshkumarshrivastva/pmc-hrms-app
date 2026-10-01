import Link from "next/link";
import { generatePayslipsAction } from "@/app/actions";
import { MonthPicker } from "@/components/MonthPicker";
import { SubmitButton } from "@/components/SubmitButton";
import { requireUser } from "@/lib/auth";
import { isValidMonth, monthLabel, monthStr } from "@/lib/dates";
import { formatINR } from "@/lib/format";
import { listEmployees, listPayslips } from "@/lib/queries";

export default async function PayslipsPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const user = await requireUser();
  if (user.role === "ADMIN") return <AdminSlips searchParams={searchParams} />;
  const slips = await listPayslips({ employeeId: user.id });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Salary slips</h1>
        <p className="text-sm text-muted">Your generated slips</p>
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="table">
          <thead>
            <tr><th>Month</th><th>Gross</th><th>Net pay</th><th /></tr>
          </thead>
          <tbody>
            {slips.length === 0 && <tr><td colSpan={4} className="py-8 text-center text-muted">No salary slips yet.</td></tr>}
            {slips.map((p) => (
              <tr key={p.id}>
                <td className="font-medium">{monthLabel(p.month)}</td>
                <td>{formatINR(p.gross)}</td>
                <td className="font-semibold">{formatINR(p.net)}</td>
                <td className="text-right"><Link href={`/payslips/${p.id}`} className="text-sm font-medium text-accent">View / Print</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Admin: every employee for one month, with their slip (or a Generate button when it doesn't exist yet). */
async function AdminSlips({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { month: m } = await searchParams;
  const all = await listPayslips({});
  // Default to the latest month that has slips, otherwise the current month.
  const month = isValidMonth(m) ? m : all[0]?.month ?? monthStr();
  const slips = new Map(all.filter((p) => p.month === month).map((p) => [p.employee_id, p]));
  const employees = (await listEmployees({ activeOnly: true })).filter((e) => e.join_date.slice(0, 7) <= month);
  const missing = employees.filter((e) => !slips.has(e.id)).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Salary slips</h1>
          <p className="text-sm text-muted">{employees.length} employees · {employees.length - missing} slips generated for {monthLabel(month)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <MonthPicker month={month} hrefFor={(x) => `/payslips?month=${x}`} />
          {missing > 0 && (
            <form action={generatePayslipsAction}>
              <input type="hidden" name="month" value={month} />
              <input type="hidden" name="missing_only" value="1" />
              <SubmitButton pendingText="Generating...">Generate {missing} missing</SubmitButton>
            </form>
          )}
        </div>
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="table">
          <thead>
            <tr><th>Employee</th><th>Gross</th><th>Net pay</th><th /></tr>
          </thead>
          <tbody>
            {employees.length === 0 && <tr><td colSpan={4} className="py-8 text-center text-muted">No employees yet.</td></tr>}
            {employees.map((e) => {
              const p = slips.get(e.id);
              return (
                <tr key={e.id}>
                  <td className="font-medium">{e.name} <span className="text-xs font-normal text-muted">{e.emp_code}</span></td>
                  <td>{formatINR(p ? p.gross : e.basic + e.hra + e.conveyance + e.medical + e.special)}</td>
                  <td className="font-semibold">{p ? formatINR(p.net) : <span className="font-normal text-muted">Not generated</span>}</td>
                  <td className="text-right">
                    {p ? (
                      <Link href={`/payslips/${p.id}`} className="text-sm font-medium text-accent">View / Print</Link>
                    ) : (
                      <form action={generatePayslipsAction}>
                        <input type="hidden" name="month" value={month} />
                        <input type="hidden" name="employee_id" value={e.id} />
                        <SubmitButton className="text-sm font-medium text-accent" pendingText="...">Generate</SubmitButton>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
