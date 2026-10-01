import Link from "next/link";
import { generatePayslipsAction } from "@/app/actions";
import { MonthPicker } from "@/components/MonthPicker";
import { SubmitButton } from "@/components/SubmitButton";
import { requireAdmin } from "@/lib/auth";
import { isValidMonth, monthLabel, monthStr, todayStr } from "@/lib/dates";
import { formatINR } from "@/lib/format";
import { listEmployees, listPayslips } from "@/lib/queries";
import { getMonthSalary } from "@/lib/salary";

export default async function PayrollPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  await requireAdmin();
  const { month: m } = await searchParams;
  const month = isValidMonth(m) ? m : monthStr();
  const today = todayStr();
  const inProgress = month >= monthStr();

  const payslips = new Map((await listPayslips({ month })).map((p) => [p.employee_id, p]));
  const employees = (await listEmployees({ activeOnly: true })).filter((e) => e.join_date.slice(0, 7) <= month);
  const rows = await Promise.all(
    employees.map(async (e) => ({ e, s: await getMonthSalary(e, month, today), slip: payslips.get(e.id) })),
  );

  const total = rows.reduce((sum, r) => sum + r.s.net, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Payroll — {monthLabel(month)}</h1>
          <p className="text-sm text-muted">
            Net payable: <span className="font-semibold text-foreground">{formatINR(total)}</span> for {rows.length} employees
          </p>
        </div>
        <div className="flex items-center gap-3">
          <MonthPicker month={month} hrefFor={(x) => `/payroll?month=${x}`} />
          <form action={generatePayslipsAction}>
            <input type="hidden" name="month" value={month} />
            <SubmitButton pendingText="Generating...">Generate all slips</SubmitButton>
          </form>
        </div>
      </div>

      {inProgress && (
        <p className="rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-800">
          This month isn&apos;t over yet. Figures are provisional — regenerate slips after month end so late punches and corrections are included.
        </p>
      )}

      <div className="card overflow-x-auto p-0">
        <table className="table">
          <thead>
            <tr>
              <th>Employee</th><th>Payable days</th><th>Gross</th><th>OT</th><th>LOP</th><th>PF &amp; taxes</th><th>Net pay</th><th>Slip</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ e, s, slip }) => (
              <tr key={e.id}>
                <td>
                  <p className="font-medium">{e.name}</p>
                  <p className="text-xs text-muted">{e.emp_code}</p>
                </td>
                <td>{s.paidDays} / {s.calendarDays}</td>
                <td>{formatINR(s.gross)}</td>
                <td className="text-green-700">{s.overtimePay ? `+ ${formatINR(s.overtimePay)}` : "—"}</td>
                <td className="text-red-600">{s.lopDeduction ? `− ${formatINR(s.lopDeduction)}` : "—"}</td>
                <td className="text-red-600">{s.pf + s.professionalTax + s.esi + s.tds ? `− ${formatINR(s.pf + s.professionalTax + s.esi + s.tds)}` : "—"}</td>
                <td className="font-semibold">{formatINR(s.net)}</td>
                <td>
                  <div className="flex items-center gap-3">
                    {slip && <Link href={`/payslips/${slip.id}`} className="text-sm font-medium text-accent">View</Link>}
                    <form action={generatePayslipsAction}>
                      <input type="hidden" name="month" value={month} />
                      <input type="hidden" name="employee_id" value={e.id} />
                      <SubmitButton className="btn px-3 py-1" pendingText="...">{slip ? "Regenerate" : "Generate"}</SubmitButton>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">
        Gross = Basic + HRA + Conveyance + Medical + Special. Per-day salary = gross ÷ days in the month; LOP = per-day × unpaid days (Sundays, holidays and approved paid leave are paid). PF = 12% of earned basic; Professional Tax, ESI and TDS are the fixed amounts set on the employee. OT = hours beyond 8 (or on off days) × hourly rate × 1.5, for employees with overtime enabled.
      </p>
    </div>
  );
}
