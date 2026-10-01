import Link from "next/link";
import { notFound } from "next/navigation";
import { updatePayslipAction } from "@/app/actions";
import { PayslipEditForm } from "@/components/PayslipEditForm";
import { requireAdmin } from "@/lib/auth";
import { monthLabel } from "@/lib/dates";
import { getPayslip } from "@/lib/queries";
import { withSlipDefaults } from "@/lib/slip";

export default async function EditPayslipPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const stored = await getPayslip(Number((await params).id));
  if (!stored) notFound();
  const slip = withSlipDefaults(stored);

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <Link href={`/payslips/${slip.id}`} className="text-sm font-medium text-accent">&larr; Back to slip</Link>
        <h1 className="mt-1 text-xl font-bold">Edit salary slip</h1>
        <p className="text-sm text-muted">{slip.emp_name} · {monthLabel(slip.month)}</p>
      </div>
      <PayslipEditForm action={updatePayslipAction.bind(null, slip.id)} slip={slip} monthLabel={monthLabel(slip.month)} />
    </div>
  );
}
