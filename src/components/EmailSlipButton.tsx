"use client";

import { useState } from "react";
import { emailPayslipAction } from "@/app/actions";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";

/** "Email slip" button that opens a small form to send the PDF straight from the slip page. */
export function EmailSlipButton({ slipId, defaultTo }: { slipId: number; defaultTo: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="print:hidden">
      <button type="button" onClick={() => setOpen((v) => !v)} className="btn">Email slip</button>
      {open && (
        <div className="absolute right-0 z-10 mt-2 w-80 rounded-xl border border-border bg-white p-4 shadow-lg">
          <ActionForm action={emailPayslipAction.bind(null, slipId)} className="space-y-3">
            <label className="block text-sm font-medium">
              To
              <input name="to" type="email" required defaultValue={defaultTo} className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm" />
            </label>
            <label className="block text-sm font-medium">
              Message (optional)
              <textarea name="message" rows={2} className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm" />
            </label>
            <SubmitButton pendingText="Sending...">Send email</SubmitButton>
          </ActionForm>
        </div>
      )}
    </div>
  );
}
