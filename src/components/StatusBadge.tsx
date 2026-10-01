import type { DayStatus } from "@/lib/payroll";

const STYLES: Record<DayStatus, { label: string; cls: string }> = {
  PRESENT: { label: "Present", cls: "bg-green-100 text-green-700" },
  HALF_DAY: { label: "Half day", cls: "bg-amber-100 text-amber-700" },
  INCOMPLETE: { label: "No punch-out", cls: "bg-orange-100 text-orange-700" },
  ABSENT: { label: "Absent", cls: "bg-red-100 text-red-700" },
  LEAVE: { label: "On leave", cls: "bg-sky-100 text-sky-700" },
  UNPAID_LEAVE: { label: "Unpaid leave", cls: "bg-rose-100 text-rose-700" },
  HOLIDAY: { label: "Holiday", cls: "bg-purple-100 text-purple-700" },
  NOT_IN: { label: "Not in yet", cls: "bg-blue-100 text-blue-700" },
  WEEKLY_OFF: { label: "Weekly off", cls: "bg-gray-100 text-gray-600" },
  FUTURE: { label: "—", cls: "text-muted" },
};

export function StatusBadge({ status }: { status: DayStatus }) {
  const s = STYLES[status];
  return <span className={`badge ${s.cls}`}>{s.label}</span>;
}
