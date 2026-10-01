import { redirect } from "next/navigation";
import { AutoRefresh } from "@/components/AutoRefresh";
import { requireUser } from "@/lib/auth";
import { fmtTime, todayStr } from "@/lib/dates";
import { STALE_MS, TRACK_RADIUS_M } from "@/lib/geo";
import { getAttendance, listEmployees, listLocations } from "@/lib/queries";

export default async function LocationPage() {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/dashboard");
  const today = todayStr();
  const nowMs = new Date().getTime();
  const [employees, pings] = await Promise.all([listEmployees({ activeOnly: true }), listLocations()]);
  const tracked = employees.filter((e) => e.track_location !== 0);
  const rows = await Promise.all(
    tracked.map(async (e) => {
      const att = await getAttendance(e.id, today);
      const ping = pings.find((p) => p.employee_id === e.id && p.date === today);
      const working = Boolean(att && !att.punch_out);
      let status: "off" | "nosignal" | "working" | "away";
      if (!working) status = "off";
      else if (!ping || nowMs - new Date(ping.at).getTime() > STALE_MS) status = "nosignal";
      else status = ping.distance_m > TRACK_RADIUS_M ? "away" : "working";
      return { e, att, ping, status };
    }),
  );
  const badge = {
    working: ["Working", "bg-green-50 text-green-700"],
    away: ["Not connected", "bg-red-50 text-red-700"],
    nosignal: ["No signal", "bg-amber-50 text-amber-800"],
    off: ["Not punched in", "bg-gray-100 text-gray-600"],
  } as const;

  return (
    <div className="space-y-6">
      <AutoRefresh seconds={10} />
      <div>
        <h1 className="text-2xl font-semibold">Live location</h1>
        <p className="text-sm text-muted">
          All active employees (tracking is on for everyone by default). Shows &quot;Not connected&quot; when the phone is more than {TRACK_RADIUS_M} m from the punch-in spot.
          Refreshes every 10 seconds.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="card text-sm text-muted">No employee has location tracking on yet. Open Employees → edit → tick &quot;Track phone location&quot;.</p>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs text-muted">
              <tr>
                <th className="px-4 py-2">Employee</th><th className="px-4 py-2">Mobile</th><th className="px-4 py-2">Punched in</th>
                <th className="px-4 py-2">Status</th><th className="px-4 py-2">Distance</th><th className="px-4 py-2">Last update</th><th className="px-4 py-2">Map</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ e, att, ping, status }) => (
                <tr key={e.id} className="border-t border-border">
                  <td className="px-4 py-2 font-medium">{e.name}</td>
                  <td className="px-4 py-2">{e.phone}</td>
                  <td className="px-4 py-2">{att ? fmtTime(att.punch_in) : "—"}</td>
                  <td className="px-4 py-2">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${badge[status][1]}`}>{badge[status][0]}</span>
                  </td>
                  <td className="px-4 py-2">{ping && status !== "off" ? `${ping.distance_m} m` : "—"}</td>
                  <td className="px-4 py-2">{ping && status !== "off" ? fmtTime(ping.at) : "—"}</td>
                  <td className="px-4 py-2">
                    {ping && status !== "off" ? (
                      <a className="font-medium text-accent" target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${ping.lat},${ping.lng}`}>Open</a>
                    ) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
