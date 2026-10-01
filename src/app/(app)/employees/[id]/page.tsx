import Link from "next/link";
import { notFound } from "next/navigation";
import { updateEmployeeAction } from "@/app/actions";
import { Avatar } from "@/components/Avatar";
import { EmployeeForm } from "@/components/EmployeeForm";
import { requireAdmin } from "@/lib/auth";
import { todayStr } from "@/lib/dates";
import { getEmployee, listDepartments, listDesignations } from "@/lib/queries";

export default async function EditEmployeePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const employee = await getEmployee(Number((await params).id));
  if (!employee) notFound();
  const [departments, designations] = await Promise.all([listDepartments(), listDesignations()]);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <Link href="/employees" className="text-sm font-medium text-accent">&larr; Employees</Link>
        <div className="mt-2 flex items-center gap-3">
          <Avatar name={employee.name} size={44} />
          <div>
            <h1 className="text-2xl font-semibold leading-tight">{employee.name}</h1>
            <p className="text-sm text-muted">{employee.emp_code} · +91 {employee.phone}</p>
          </div>
        </div>
      </div>
      <EmployeeForm
        action={updateEmployeeAction.bind(null, employee.id)} employee={employee} today={todayStr()}
        departments={departments} designations={designations}
      />
    </div>
  );
}
