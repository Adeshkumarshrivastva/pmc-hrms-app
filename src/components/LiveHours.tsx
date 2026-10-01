"use client";

import { useEffect, useState } from "react";
import { fmtHours, hoursBetween } from "@/lib/dates";

/** Base hours plus the time elapsed since `startIso` (an open punch-in), ticking every 30s. */
export function LiveHours({ startIso, baseHours = 0 }: { startIso: string; baseHours?: number }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  return <span suppressHydrationWarning>{fmtHours(baseHours + hoursBetween(startIso, new Date(now).toISOString()))}</span>;
}
