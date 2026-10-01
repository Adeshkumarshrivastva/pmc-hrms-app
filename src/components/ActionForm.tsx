"use client";

import { useActionState, useEffect, useRef } from "react";
import type { FormState } from "@/app/actions";

type Props = {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  children: React.ReactNode;
  className?: string;
};

/** A <form> that shows the error/success message returned by a server action. */
export function ActionForm({ action, children, className }: Props) {
  const [state, formAction] = useActionState(action, {} as FormState);
  const ref = useRef<HTMLFormElement>(null);
  // Clear the fields after a successful submit (e.g. leave request, new holiday).
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={formAction} className={className}>
      {children}
      {state.error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      {state.ok && <p className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{state.ok}</p>}
    </form>
  );
}
