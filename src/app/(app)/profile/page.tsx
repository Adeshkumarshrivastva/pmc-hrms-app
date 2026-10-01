import { requireUser } from "@/lib/auth";
import { fmtDateLong } from "@/lib/dates";

export default async function ProfilePage() {
  const user = await requireUser();
  const rows: [string, string][] = [
    ["Name", user.name],
    ["Employee code", user.emp_code],
    ["Mobile", `+91 ${user.phone}`],
    ["Email", user.email],
    ["Designation", user.designation || "—"],
    ["Department", user.department || "—"],
    ["Joined", fmtDateLong(user.join_date)],
  ];

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-2xl font-semibold">My profile</h1>
      <dl className="card space-y-2 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between border-b border-dashed border-border pb-1 last:border-0">
            <dt className="text-muted">{k}</dt>
            <dd className="font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-muted">To change your mobile number or details, ask your admin.</p>
    </div>
  );
}
