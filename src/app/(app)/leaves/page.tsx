import { applyLeaveAction, cancelLeaveAction, decideLeaveAction } from "@/app/actions";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { requireUser } from "@/lib/auth";
import { fmtDate, toDmy, todayStr } from "@/lib/dates";
import { getBalance } from "@/lib/leave";
import { listLeaves } from "@/lib/queries";
import { LEAVE_TYPE_LABELS, type LeaveRequest, type LeaveStatus } from "@/lib/types";

const STATUS_STYLE: Record<LeaveStatus, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  APPROVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
  CANCELLED: "bg-gray-100 text-gray-600",
};

function dateRange(l: LeaveRequest) {
  return l.start_date === l.end_date ? fmtDate(l.start_date) : `${fmtDate(l.start_date)} → ${fmtDate(l.end_date)}`;
}

export default async function LeavesPage() {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";
  const today = todayStr();
  const balance = await getBalance(user.id, Number(today.slice(0, 4)));
  const mine = await listLeaves({ employeeId: user.id });
  const pending = isAdmin ? await listLeaves({ status: "PENDING" }) : [];
  const everyone = isAdmin ? (await listLeaves()).filter((l) => l.status !== "PENDING").slice(0, 50) : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Leaves</h1>
        <p className="text-sm text-muted">{balance.quota} paid leaves per year ({today.slice(0, 4)}). Weekly offs and holidays don&apos;t use up leave.</p>
      </div>

      <div className="card py-4">
        <p className="text-sm text-muted">Paid leave balance</p>
        <p className="mt-1 text-3xl font-semibold">{balance.remaining}<span className="text-base font-normal text-muted"> / {balance.quota} left</span></p>
        <p className="text-xs text-muted">{balance.used} taken{balance.pending ? ` · ${balance.pending} pending approval` : ""}</p>
      </div>

      {isAdmin && (
        <section className="card p-0">
          <div className="px-5 py-4">
            <h2 className="font-semibold">Pending approvals ({pending.length})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Employee</th><th>Leave</th><th>Days</th><th>Reason</th><th>Decision</th></tr></thead>
              <tbody>
                {pending.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-muted">Nothing waiting. 🎉</td></tr>}
                {pending.map((l) => (
                  <tr key={l.id}>
                    <td className="font-medium">{l.emp_name}<span className="block text-xs font-normal text-muted">{l.emp_code}</span></td>
                    <td>{LEAVE_TYPE_LABELS[l.type]}<span className="block text-xs text-muted">{dateRange(l)}{l.half_day ? " (half day)" : ""}</span></td>
                    <td>{l.days}</td>
                    <td className="max-w-48 text-muted">{l.reason || "—"}</td>
                    <td>
                      <ActionForm action={decideLeaveAction} className="flex flex-wrap items-center gap-2">
                        <input type="hidden" name="id" value={l.id} />
                        <input name="admin_note" placeholder="Note (optional)" className="input w-40 py-1" />
                        <SubmitButton name="decision" value="APPROVED" className="btn btn-primary px-3 py-1" pendingText="...">Approve</SubmitButton>
                        <SubmitButton name="decision" value="REJECTED" className="btn px-3 py-1" pendingText="...">Reject</SubmitButton>
                      </ActionForm>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="card">
        <h2 className="mb-4 font-semibold">Apply for leave</h2>
        <ActionForm action={applyLeaveAction} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-4">
            <div>
              <label className="label" htmlFor="type">Type</label>
              <select id="type" name="type" className="input" defaultValue="CASUAL">
                <option value="CASUAL">Paid Leave</option>
                <option value="UNPAID">Unpaid Leave</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="start_date">From</label>
              <input id="start_date" name="start_date" required inputMode="numeric" placeholder="DD-MM-YYYY" defaultValue={toDmy(todayStr())} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="end_date">To (optional)</label>
              <input id="end_date" name="end_date" inputMode="numeric" placeholder="DD-MM-YYYY" className="input" />
            </div>
            <label className="flex items-end gap-2 pb-2 text-sm">
              <input type="checkbox" name="half_day" /> Half day
            </label>
          </div>
          <div>
            <label className="label" htmlFor="reason">Reason</label>
            <input id="reason" name="reason" className="input" placeholder="Optional" />
          </div>
          <SubmitButton pendingText="Sending...">Send request</SubmitButton>
        </ActionForm>
      </section>

      <LeaveTable title="My requests" leaves={mine} cancellable />
      {isAdmin && <LeaveTable title="Recent decisions — all employees" leaves={everyone} showEmployee decidable />}
    </div>
  );
}

function LeaveTable({ title, leaves, showEmployee, cancellable, decidable }: {
  title: string; leaves: LeaveRequest[]; showEmployee?: boolean; cancellable?: boolean; decidable?: boolean;
}) {
  return (
    <section className="card p-0">
      <div className="px-5 py-4"><h2 className="font-semibold">{title}</h2></div>
      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>{showEmployee && <th>Employee</th>}<th>Leave</th><th>Days</th><th>Status</th><th>Note</th><th /></tr>
          </thead>
          <tbody>
            {leaves.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-muted">No leave requests yet.</td></tr>}
            {leaves.map((l) => (
              <tr key={l.id}>
                {showEmployee && <td className="font-medium">{l.emp_name}</td>}
                <td>{LEAVE_TYPE_LABELS[l.type]}<span className="block text-xs text-muted">{dateRange(l)}{l.half_day ? " (half day)" : ""}</span></td>
                <td>{l.days}</td>
                <td><span className={`badge ${STATUS_STYLE[l.status]}`}>{l.status.charAt(0) + l.status.slice(1).toLowerCase()}</span></td>
                <td className="text-muted">{l.admin_note || l.reason || "—"}</td>
                <td className="text-right">
                  {cancellable && l.status === "PENDING" && (
                    <form action={cancelLeaveAction}>
                      <input type="hidden" name="id" value={l.id} />
                      <button className="text-sm font-medium text-red-600">Cancel</button>
                    </form>
                  )}
                  {decidable && l.status === "APPROVED" && (
                    <ActionForm action={decideLeaveAction}>
                      <input type="hidden" name="id" value={l.id} />
                      <SubmitButton name="decision" value="REJECTED" className="text-sm font-medium text-red-600" pendingText="...">Revoke</SubmitButton>
                    </ActionForm>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
