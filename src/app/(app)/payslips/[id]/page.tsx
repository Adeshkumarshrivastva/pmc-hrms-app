import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/PrintButton";
import { requireUser } from "@/lib/auth";
import { getEmployee, getPayslip } from "@/lib/queries";
import { buildSlipModel, type SlipRow } from "@/lib/slip";

// Colours and layout follow the company salary-slip template (Adesh-Salary-Slip.docx).
export default async function PayslipPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const slip = await getPayslip(Number((await params).id));
  // Employees may only open their own slips; report others as missing.
  if (!slip || (user.role !== "ADMIN" && slip.employee_id !== user.id)) notFound();
  const employee = await getEmployee(slip.employee_id);
  const m = buildSlipModel(slip, employee?.join_date ?? null);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <Link href="/payslips" className="text-sm font-medium text-accent">&larr; All slips</Link>
        <div className="flex gap-2">
          {user.role === "ADMIN" && <Link href={`/payslips/${slip.id}/edit`} className="btn">Edit slip</Link>}
          <a href={`/payslips/${slip.id}/pdf`} className="btn btn-primary">Download PDF</a>
          <PrintButton />
        </div>
      </div>

      <article className="space-y-5 border border-border bg-white p-8 text-[13px] shadow-sm [print-color-adjust:exact] print:border-0 print:p-0 print:shadow-none">
        <header>
          <div className="flex items-center gap-3">
            <Image src="/logo.png" width={117} height={44} alt="Positive Mind Care" unoptimized className="h-11 w-auto rounded-sm" />
            <div>
              <h1 className="text-lg font-bold text-[#0A3D26]">{m.company.name}</h1>
              <p className="text-[11px] font-semibold tracking-wide text-gray-500">SALARY SLIP</p>
            </div>
          </div>
          <hr className="mt-3 border-t-2 border-[#0A3D26]" />
          <h2 className="mt-4 text-center text-sm font-bold text-[#0A3D26]">{m.title}</h2>
        </header>

        <PairTable title="Employee Information" cells={m.info} headerWidth="50%" />
        <PairTable title="Attendance & Leave Details" cells={m.attendance} headerWidth="44%" />

        <div className="grid gap-4 sm:grid-cols-2 print:grid-cols-2">
          <AmountTable title="Earnings" color="bg-[#2D7C4F]" rows={m.earnings} totalLabel="Gross Earnings" total={m.totalEarnings} />
          <AmountTable title="Deductions" color="bg-[#B33A3A]" rows={m.deductions} totalLabel="Total Deductions" total={m.totalDeductions} />
        </div>

        <div className="bg-[#0A3D26] px-4 py-3.5 text-white">
          <p className="text-[#F0CE72]">
            <span className="font-bold">NET PAY FOR THE MONTH:</span>{" "}
            <span className="ml-1 text-xl font-bold text-white">{m.net}</span>
          </p>
          <p className="mt-1 text-xs italic">{m.words}</p>
        </div>

        <footer className="pt-6 text-right text-xs">
          <p>For {m.company.signatory}</p>
          <p className="mt-12 text-[11px] text-gray-500">Authorised Signatory</p>
        </footer>
      </article>
    </div>
  );
}

/** Rows laid out as label | value | label | value, like the template's information tables. */
function PairTable({ title, cells, headerWidth }: { title: string; cells: SlipRow[]; headerWidth: string }) {
  const rows: SlipRow[][] = [];
  for (let i = 0; i < cells.length; i += 2) rows.push(cells.slice(i, i + 2));
  return (
    <section>
      <div className="bg-[#0A3D26] px-3 py-1.5 text-xs font-semibold text-white" style={{ width: headerWidth }}>{title}</div>
      <table className="w-full table-fixed border-collapse">
        <colgroup><col className="w-[26%]" /><col className="w-[24%]" /><col className="w-[23%]" /><col className="w-[27%]" /></colgroup>
        <tbody>
          {rows.map((pair, i) => (
            <tr key={i} className="border-b border-[#E3EDE7]">
              {pair.map((c) => (
                <FragmentCells key={c.label} cell={c} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function FragmentCells({ cell }: { cell: SlipRow }) {
  const danger = cell.tone === "danger";
  return (
    <>
      <td className="bg-[#E9F4EB] px-2.5 py-2 text-xs font-semibold text-gray-500">{cell.label}</td>
      <td className={`px-2.5 py-2 text-xs font-bold ${danger ? "bg-[#FDEDED] text-[#B33A3A]" : "text-gray-900"}`}>{cell.value}</td>
    </>
  );
}

function AmountTable({ title, color, rows, totalLabel, total }: {
  title: string; color: string; rows: SlipRow[]; totalLabel: string; total: string;
}) {
  return (
    <table className="w-full border-collapse text-xs">
      <thead>
        <tr className={`${color} text-white`}>
          <th className="px-2.5 py-2 text-left font-semibold">{title}</th>
          <th className="px-2.5 py-2 text-right font-semibold">Amount (₹)</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.label} className="border-b border-[#E3EDE7]">
            <td className="px-2.5 py-2">{r.label}</td>
            <td className={`px-2.5 py-2 text-right ${r.tone === "danger" ? "text-[#B33A3A]" : ""}`}>{r.value}</td>
          </tr>
        ))}
        <tr className="border-b border-[#E3EDE7] font-bold">
          <td className="px-2.5 py-2">{totalLabel}</td>
          <td className="px-2.5 py-2 text-right">{total}</td>
        </tr>
      </tbody>
    </table>
  );
}
