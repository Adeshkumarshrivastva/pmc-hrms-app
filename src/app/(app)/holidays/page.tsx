import Link from "next/link";
import { addHolidayAction, deleteHolidayAction } from "@/app/actions";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { requireUser } from "@/lib/auth";
import { fmtDate, todayStr } from "@/lib/dates";
import { listHolidays } from "@/lib/queries";

export default async function HolidaysPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const user = await requireUser();
  const thisYear = Number(todayStr().slice(0, 4));
  const { year: y } = await searchParams;
  const year = /^\d{4}$/.test(y ?? "") ? Number(y) : thisYear;
  const holidays = await listHolidays(year);
  const today = todayStr();
  const isAdmin = user.role === "ADMIN";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Holidays {year}</h1>
          <p className="text-sm text-muted">Paid days off. They don&apos;t count as working days or use up leave.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/holidays?year=${year - 1}`} className="btn px-3">&larr;</Link>
          <Link href={`/holidays?year=${year + 1}`} className="btn px-3">&rarr;</Link>
        </div>
      </div>

      {isAdmin && (
        <ActionForm action={addHolidayAction} className="card flex flex-wrap items-end gap-3">
          <div>
            <label className="label" htmlFor="date">Date</label>
            <input id="date" name="date" type="date" required defaultValue={`${year}-01-01`} className="input" />
          </div>
          <div className="min-w-56 flex-1">
            <label className="label" htmlFor="name">Holiday name</label>
            <input id="name" name="name" required placeholder="e.g. Diwali" className="input" />
          </div>
          <SubmitButton>Add holiday</SubmitButton>
        </ActionForm>
      )}

      <div className="card overflow-x-auto p-0">
        <table className="table">
          <thead><tr><th>Date</th><th>Holiday</th><th />{isAdmin && <th />}</tr></thead>
          <tbody>
            {holidays.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-muted">No holidays added for {year}.</td></tr>}
            {holidays.map((h) => (
              <tr key={h.date}>
                <td className="whitespace-nowrap">{fmtDate(h.date)}</td>
                <td className="font-medium">{h.name}</td>
                <td>{h.date < today ? <span className="text-xs text-muted">Past</span> : <span className="badge bg-purple-100 text-purple-700">Upcoming</span>}</td>
                {isAdmin && (
                  <td className="text-right">
                    <form action={deleteHolidayAction}>
                      <input type="hidden" name="date" value={h.date} />
                      <button className="text-sm font-medium text-red-600">Remove</button>
                    </form>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
