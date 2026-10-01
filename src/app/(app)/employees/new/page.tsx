import Link from "next/link";
import { createEmployeeAction } from "@/app/actions";
import { EmployeeForm } from "@/components/EmployeeForm";
import { requireAdmin } from "@/lib/auth";
import { todayStr } from "@/lib/dates";
import { listDepartments, listDesignations } from "@/lib/queries";

export default async function NewEmployeePage() {
  await requireAdmin();
  const [departments, designations] = await Promise.all([listDepartments(), listDesignations()]);
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <Link href="/employees" className="text-sm font-medium text-accent">&larr; Employees</Link>
        <h1 className="mt-1 text-2xl font-semibold">Add employee</h1>
      </div>
      <EmployeeForm action={createEmployeeAction} today={todayStr()} departments={departments} designations={designations} />
    </div>
  );
}
