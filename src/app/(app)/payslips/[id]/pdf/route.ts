import { getCurrentUser } from "@/lib/auth";
import { getEmployee, getPayslip } from "@/lib/queries";
import { buildSlipPdf } from "@/lib/slip-pdf";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const slip = await getPayslip(Number((await params).id));
  if (!slip || (user.role !== "ADMIN" && slip.employee_id !== user.id)) return new Response("Not found", { status: 404 });
  const { bytes, fileName } = await buildSlipPdf(slip, await getEmployee(slip.employee_id));
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
