import Link from "next/link";
import { notFound } from "next/navigation";
import { saveAttendanceAction } from "@/app/actions";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { requireAdmin } from "@/lib/auth";
import { fmtDateLong, isoToIstLocal, isValidDate } from "@/lib/dates";
import { getAttendance, getEmployee } from "@/lib/queries";

type SP = Promise<Record<string, string | string[] | undefined>>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function EditAttendancePage({ searchParams }: { searchParams: SP }) {
  await requireAdmin();
  const sp = await searchParams;
  const employee = await getEmployee(Number(first(sp.emp)));
  const date = first(sp.date);
  if (!employee || !isValidDate(date)) notFound();

  const record = await getAttendance(employee.id, date);
  const action = saveAttendanceAction.bind(null, employee.id, date);

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">{record ? "Edit" : "Add"} attendance</h1>
        <p className="text-sm text-muted">{employee.name} · {fmtDateLong(date)} (times in IST)</p>
      </div>
      <ActionForm action={action} className="card space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="punch_in">Punch in</label>
            <input id="punch_in" name="punch_in" type="datetime-local" required className="input"
              defaultValue={record ? isoToIstLocal(record.punch_in) : `${date}T09:30`} />
          </div>
          <div>
            <label className="label" htmlFor="punch_out">Punch out</label>
            <input id="punch_out" name="punch_out" type="datetime-local" className="input"
              defaultValue={record?.punch_out ? isoToIstLocal(record.punch_out) : ""} />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="note">Note</label>
          <input id="note" name="note" className="input" defaultValue={record?.note ?? ""} placeholder="e.g. Forgot to punch out" />
        </div>
        <div className="flex items-center gap-3">
          <SubmitButton>Save</SubmitButton>
          <Link href={`/attendance?emp=${employee.id}&month=${date.slice(0, 7)}`} className="btn">Cancel</Link>
          {record && (
            <SubmitButton className="btn btn-danger ml-auto" name="intent" value="delete" formNoValidate pendingText="Deleting...">
              Delete
            </SubmitButton>
          )}
        </div>
      </ActionForm>
    </div>
  );
}
