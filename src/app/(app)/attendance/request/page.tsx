import Link from "next/link";
import { requestCorrectionAction } from "@/app/org-actions";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { requireUser } from "@/lib/auth";
import { fmtDateLong, fmtTime, isValidDate, todayStr } from "@/lib/dates";
import { getAttendance } from "@/lib/queries";

export default async function RequestCorrectionPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const user = await requireUser();
  const { date: d } = await searchParams;
  const today = todayStr();
  const date = isValidDate(d) && d <= today ? d : today;
  const existing = await getAttendance(user.id, date);

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div>
        <Link href="/attendance" className="text-sm font-medium text-accent">&larr; Attendance</Link>
        <h1 className="mt-1 text-2xl font-semibold">Request an attendance correction</h1>
        <p className="text-sm text-muted">
          Forgot to punch, or punched out late? Tell your admin what the times should be — once approved, your attendance is updated.
        </p>
      </div>
      <ActionForm action={requestCorrectionAction} className="card space-y-4">
        <div>
          <label className="label" htmlFor="date">Date</label>
          <input id="date" name="date" type="date" required max={today} min={user.join_date} defaultValue={date} className="input" />
          <p className="mt-1 text-xs text-muted">
            {fmtDateLong(date)} — {existing ? `currently recorded: ${fmtTime(existing.punch_in)} to ${fmtTime(existing.punch_out)}` : "no punch recorded"}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="punch_in">Punch in</label>
            <input id="punch_in" name="punch_in" type="time" required defaultValue="09:30" className="input" />
          </div>
          <div>
            <label className="label" htmlFor="punch_out">Punch out</label>
            <input id="punch_out" name="punch_out" type="time" defaultValue="18:00" className="input" />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="reason">Reason</label>
          <input id="reason" name="reason" required minLength={3} maxLength={200} placeholder="e.g. Forgot to punch out" className="input" />
        </div>
        <SubmitButton pendingText="Sending...">Send request</SubmitButton>
      </ActionForm>
    </div>
  );
}
