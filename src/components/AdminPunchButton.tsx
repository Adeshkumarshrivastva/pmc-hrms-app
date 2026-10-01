"use client";

import { useState, useTransition } from "react";
import { adminPunchAction } from "@/app/actions";

type Props = {
  employeeId: number;
  /** "none" = not punched in, "working" = punched in only, "done" = punched out. */
  state: "none" | "working" | "done";
};

const CONFIG = {
  none: { kind: "in", label: "Punch In", cls: "btn btn-primary" },
  working: { kind: "out", label: "Punch Out", cls: "btn btn-danger" },
  done: { kind: "again", label: "Punch In Again", cls: "btn" },
} as const;

export function AdminPunchButton({ employeeId, state }: Props) {
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const { kind, label, cls } = CONFIG[state];

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        className={`${cls} px-2 py-1 text-xs`}
        disabled={pending}
        onClick={() => startTransition(async () => setError((await adminPunchAction(employeeId, kind)).error))}
      >
        {pending ? "Saving..." : label}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
