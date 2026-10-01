import Link from "next/link";
import { addLookupAction, deleteLookupAction } from "@/app/org-actions";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { requireAdmin } from "@/lib/auth";
import { listDepartments, listDesignations, listEmployees } from "@/lib/queries";

export default async function OrgSetupPage() {
  await requireAdmin();
  const [departments, designations, employees] = await Promise.all([listDepartments(), listDesignations(), listEmployees()]);
  const count = (field: "department" | "designation", name: string) => employees.filter((e) => e[field] === name).length;

  return (
    <div className="space-y-5">
      <div>
        <Link href="/employees" className="text-sm font-medium text-accent">&larr; Employees</Link>
        <h1 className="mt-1 text-2xl font-semibold">Departments &amp; designations</h1>
        <p className="text-sm text-muted">These fill the dropdowns on the employee form. You can also add new ones right from that form.</p>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel kind="department" title="Departments" items={departments} usage={(n) => count("department", n)} />
        <Panel kind="designation" title="Designations" items={designations} usage={(n) => count("designation", n)} />
      </div>
    </div>
  );
}

function Panel({ kind, title, items, usage }: {
  kind: "department" | "designation"; title: string; items: string[]; usage: (name: string) => number;
}) {
  return (
    <section className="card p-0">
      <div className="border-b border-border px-5 py-4">
        <h2 className="font-semibold">{title} <span className="font-normal text-muted">({items.length})</span></h2>
        <ActionForm action={addLookupAction.bind(null, kind)} className="mt-3">
          <div className="flex gap-2">
            <input name="name" required placeholder={`New ${kind}`} maxLength={60} className="input" />
            <SubmitButton pendingText="Adding...">Add</SubmitButton>
          </div>
        </ActionForm>
      </div>
      <ul className="divide-y divide-border">
        {items.length === 0 && <li className="px-5 py-6 text-center text-sm text-muted">Nothing here yet.</li>}
        {items.map((name) => {
          const used = usage(name);
          return (
            <li key={name} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
              <span className="font-medium">{name}</span>
              <span className="flex items-center gap-4">
                <span className="text-xs text-muted">{used ? `${used} employee${used === 1 ? "" : "s"}` : "unused"}</span>
                {used === 0 ? (
                  <form action={deleteLookupAction.bind(null, kind)}>
                    <input type="hidden" name="name" value={name} />
                    <button className="text-xs font-medium text-red-600 hover:underline">Remove</button>
                  </form>
                ) : (
                  <span className="w-11 text-xs text-muted" title="Move these employees to another value first">in use</span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
