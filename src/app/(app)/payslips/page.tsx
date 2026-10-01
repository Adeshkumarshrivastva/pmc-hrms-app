import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { monthLabel } from "@/lib/dates";
import { formatINR } from "@/lib/format";
import { listPayslips } from "@/lib/queries";

export default async function PayslipsPage() {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";
  const slips = await listPayslips(isAdmin ? {} : { employeeId: user.id });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Salary slips</h1>
        <p className="text-sm text-muted">{isAdmin ? "All generated slips" : "Your generated slips"}</p>
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="table">
          <thead>
            <tr><th>Month</th>{isAdmin && <th>Employee</th>}<th>Gross</th><th>Net pay</th><th /></tr>
          </thead>
          <tbody>
            {slips.length === 0 && (
              <tr><td colSpan={isAdmin ? 5 : 4} className="py-8 text-center text-muted">
                No salary slips yet.{isAdmin && <> Generate them from <Link href="/payroll" className="text-accent">Payroll</Link>.</>}
              </td></tr>
            )}
            {slips.map((p) => (
              <tr key={p.id}>
                <td className="font-medium">{monthLabel(p.month)}</td>
                {isAdmin && <td>{p.emp_name} <span className="text-xs text-muted">{p.emp_code}</span></td>}
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
