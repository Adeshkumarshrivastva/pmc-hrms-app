"use client";

import Link from "next/link";
import { useState } from "react";
import { ActionForm } from "./ActionForm";
import { SubmitButton } from "./SubmitButton";
import type { FormState } from "@/app/actions";
import { amountInWords, formatAmount } from "@/lib/format";
import type { Payslip } from "@/lib/types";

type Props = {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  slip: Payslip;
  monthLabel: string;
};

const EARN = ["basic", "hra", "conveyance", "medical", "special"] as const;
const DEDUCT = ["lop_deduction", "pf", "professional_tax", "esi", "tds"] as const;

export function PayslipEditForm({ action, slip, monthLabel }: Props) {
  // Keep numbers as strings while typing so the inputs behave normally; totals are derived live.
  const [v, setV] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      [...EARN, ...DEDUCT, "overtime_pay", "overtime_hours"].map((k) => [k, String(slip[k as keyof Payslip] ?? 0)]),
    ),
  );
  const n = (k: string) => Number(v[k]) || 0;
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setV((p) => ({ ...p, [k]: e.target.value }));

  const gross = EARN.reduce((s, k) => s + n(k), 0);
  const totalEarnings = gross + n("overtime_pay");
  const totalDeductions = DEDUCT.reduce((s, k) => s + n(k), 0);
  const computedNet = Math.round((totalEarnings - totalDeductions) * 100) / 100;
  // null = follow the computed total; a string = admin typed their own net pay.
  const [netOverride, setNetOverride] = useState<string | null>(() => (slip.net !== computedNetInitial(slip) ? String(slip.net) : null));
  const netValue = netOverride ?? String(computedNet);
  const net = Number(netValue) || 0;

  const text = (name: keyof Payslip, label: string) => (
    <Field label={label} name={name} defaultValue={String(slip[name] ?? "")} />
  );
  const money = (name: string, label: string) => (
    <Field label={label} name={name} type="number" min={0} step="0.01" value={v[name]} onChange={set(name)} />
  );
  const days = (name: keyof Payslip, label: string) => (
    <Field label={label} name={name} type="number" min={0} step="0.5" defaultValue={String(slip[name] ?? 0)} />
  );

  return (
    <ActionForm action={action} className="space-y-4">
      <Section title="Employee information" hint={`Shown on the slip for ${monthLabel}. The joining date comes from the employee profile.`}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Employee name" name="emp_name" defaultValue={slip.emp_name} required />
          {text("emp_code", "Employee ID")}
          {text("designation", "Designation")}
          {text("department", "Department")}
          {text("pan", "PAN")}
          {text("uan", "UAN / PF number")}
          {text("bank_name", "Bank name")}
          {text("bank_account", "Bank A/C number")}
        </div>
      </Section>

      <Section title="Attendance & leave (days)">
        <div className="grid gap-4 sm:grid-cols-3">
          {days("present_days", "Present (worked) days")}
          {days("weekly_offs", "Weekly offs")}
          {days("leave_taken", "Leave taken")}
          {days("paid_leave_days", "Leave allowed (paid)")}
          {days("lop_days", "Unpaid leave (LOP) days")}
          {days("paid_days", "Total payable days")}
          <Field label="Per day salary (₹)" name="per_day" type="number" min={0} step="0.01" defaultValue={String(slip.per_day)} />
        </div>
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Earnings (₹)" accent="bg-[#2D7C4F]">
          <div className="grid gap-4 sm:grid-cols-2">
            {money("basic", "Basic salary")}
            {money("hra", "House rent allowance")}
            {money("conveyance", "Conveyance allowance")}
            {money("medical", "Medical allowance")}
            {money("special", "Special allowance")}
            {money("overtime_pay", "Overtime pay")}
            <Field label="Overtime hours" name="overtime_hours" type="number" min={0} step="0.01" value={v.overtime_hours} onChange={set("overtime_hours")} />
          </div>
          <Total label="Gross earnings" value={totalEarnings} />
        </Section>

        <Section title="Deductions (₹)" accent="bg-[#B33A3A]">
          <div className="grid gap-4 sm:grid-cols-2">
            {money("lop_deduction", "Loss of pay")}
            {money("pf", "Provident fund (EPF)")}
            {money("professional_tax", "Professional tax")}
            {money("esi", "Employee state insurance")}
            {money("tds", "TDS (income tax)")}
          </div>
          <Total label="Total deductions" value={totalDeductions} />
        </Section>
      </div>

      <Section title="Net pay" hint="Follows earnings minus deductions unless you type your own amount. Clear the amount to go back to the calculated value.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Net pay for the month (₹)"
            name="net"
            type="number"
            step="0.01"
            value={netValue}
            onChange={(e) => setNetOverride(e.target.value === "" ? null : e.target.value)}
          />
          <Field
            label="Amount in words (optional)"
            name="net_words"
            defaultValue={slip.net_words ?? ""}
            placeholder={`Auto: ${amountInWords(net)}`}
          />
        </div>
      </Section>

      <div className="sticky bottom-3 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-[#0A3D26] px-4 py-3 text-white shadow-lg">
        <p className="text-[#F0CE72]">
          <span className="text-sm font-bold">NET PAY:</span>{" "}
          <span className="ml-1 text-xl font-bold text-white">₹ {formatAmount(net)}</span>
          {netOverride !== null && netOverride !== String(computedNet) && <span className="ml-2 text-xs text-[#F0CE72]">Manually set (calculated: ₹ {formatAmount(computedNet)})</span>}
          {net < 0 && <span className="ml-2 text-xs text-red-200">Net pay is negative</span>}
        </p>
        <div className="flex gap-3">
          <SubmitButton>Save slip</SubmitButton>
          <Link href={`/payslips/${slip.id}`} className="btn">Cancel</Link>
        </div>
      </div>
    </ActionForm>
  );
}

/** Net pay a slip would have if nobody had overridden it, used to detect a saved manual override. */
function computedNetInitial(slip: Payslip) {
  const earn = EARN.reduce((s, k) => s + (slip[k] ?? 0), 0) + (slip.overtime_pay ?? 0);
  const ded = DEDUCT.reduce((s, k) => s + (slip[k] ?? 0), 0);
  return Math.round((earn - ded) * 100) / 100;
}

function Total({ label, value }: { label: string; value: number }) {
  return (
    <p className="mt-4 flex justify-between border-t border-border pt-3 text-sm font-bold">
      <span>{label}</span>
      <span>₹ {formatAmount(value)}</span>
    </p>
  );
}

function Section({ title, hint, accent, children }: { title: string; hint?: string; accent?: string; children: React.ReactNode }) {
  return (
    <section className="card">
      <div className="flex items-center gap-2">
        {accent && <span className={`inline-block h-4 w-1.5 rounded-sm ${accent}`} />}
        <h2 className="font-semibold">{title}</h2>
      </div>
      {hint && <p className="mb-3 mt-0.5 text-xs text-muted">{hint}</p>}
      <div className={hint ? "" : "mt-3"}>{children}</div>
    </section>
  );
}

function Field({ label, name, required, ...rest }: { label: string; name: string } & React.ComponentProps<"input">) {
  return (
    <div>
      <label className="label" htmlFor={name}>
        {label}{required && <span className="text-red-600"> *</span>}
      </label>
      <input id={name} name={name} required={required} className="input" {...rest} />
    </div>
  );
}
