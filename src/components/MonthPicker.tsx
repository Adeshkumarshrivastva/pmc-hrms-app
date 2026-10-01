import Link from "next/link";
import { monthLabel, shiftMonth } from "@/lib/dates";

/** Prev / next month links. `hrefFor` builds the URL for a given month. */
export function MonthPicker({ month, hrefFor }: { month: string; hrefFor: (m: string) => string }) {
  return (
    <div className="flex items-center gap-2 print:hidden">
      <Link href={hrefFor(shiftMonth(month, -1))} className="btn px-3">&larr;</Link>
      <span className="min-w-36 text-center text-sm font-semibold">{monthLabel(month)}</span>
      <Link href={hrefFor(shiftMonth(month, 1))} className="btn px-3">&rarr;</Link>
    </div>
  );
}
