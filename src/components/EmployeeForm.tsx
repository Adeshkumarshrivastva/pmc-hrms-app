import Link from "next/link";
import { ActionForm } from "./ActionForm";
import { LookupSelect } from "./LookupSelect";
import { SubmitButton } from "./SubmitButton";
import type { FormState } from "@/app/actions";
import type { Employee } from "@/lib/types";

type Props = {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  employee?: Employee;
  today: string;
  departments: string[];
  designations: string[];
};

export function EmployeeForm({ action, employee: e, today, departments, designations }: Props) {
  return (
    <ActionForm action={action} className="space-y-4">
      <Section title="Basic details" hint="The mobile number is what the employee uses to log in (OTP), and their name is shown everywhere in the app.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" name="name" defaultValue={e?.name} required autoComplete="off" />
          <Field label="Mobile number" name="phone" type="tel" defaultValue={e?.phone} placeholder="10-digit number" required autoComplete="off" />
          <Field label="Email" name="email" type="email" defaultValue={e?.email} required autoComplete="off" />
          <Field label="Joining date" name="join_date" type="date" defaultValue={e?.join_date ?? today} required />
          <LookupSelect
            name="designation" label="Designation" options={designations} defaultValue={e?.designation}
            addLabel="Add new designation" required
          />
          <LookupSelect
            name="department" label="Department" options={departments} defaultValue={e?.department}
            addLabel="Add new department" required
          />
          <div>
            <label className="label" htmlFor="role">Access</label>
            <select id="role" name="role" defaultValue={e?.role ?? "EMPLOYEE"} className="input">
              <option value="EMPLOYEE">Employee — own attendance, leave & slips</option>
              <option value="ADMIN">Admin — manages everyone</option>
            </select>
          </div>
        </div>
      </Section>

      <Section title="Bank & ID details" hint="Printed on the salary slip.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="PAN" name="pan" defaultValue={e?.pan} maxLength={10} placeholder="ABCDE1234F" />
          <Field label="UAN / PF number" name="uan" defaultValue={e?.uan} placeholder="NA if none" />
          <Field label="Bank name" name="bank_name" defaultValue={e?.bank_name} />
          <Field label="Bank A/C number" name="bank_account" defaultValue={e?.bank_account} />
        </div>
      </Section>

      <Section title="Monthly earnings (₹)">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Basic salary" name="basic" type="number" defaultValue={e?.basic ?? 0} min={0} step="0.01" />
          <Field label="House rent allowance" name="hra" type="number" defaultValue={e?.hra ?? 0} min={0} step="0.01" />
          <Field label="Conveyance allowance" name="conveyance" type="number" defaultValue={e?.conveyance ?? 0} min={0} step="0.01" />
          <Field label="Medical allowance" name="medical" type="number" defaultValue={e?.medical ?? 0} min={0} step="0.01" />
          <Field label="Special allowance" name="special" type="number" defaultValue={e?.special ?? 0} min={0} step="0.01" />
        </div>
      </Section>

      <Section title="Fixed monthly deductions (₹)">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Professional tax" name="professional_tax" type="number" defaultValue={e?.professional_tax ?? 0} min={0} step="0.01" />
          <Field label="Employee state insurance" name="esi" type="number" defaultValue={e?.esi ?? 0} min={0} step="0.01" />
          <Field label="TDS (income tax)" name="tds" type="number" defaultValue={e?.tds ?? 0} min={0} step="0.01" />
        </div>
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="pf_enabled" defaultChecked={e ? !!e.pf_enabled : true} /> Deduct PF (12% of earned basic)
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="ot_enabled" defaultChecked={!!e?.ot_enabled} /> Pay overtime
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="track_location" defaultChecked={e ? e.track_location !== 0 : true} /> Track phone location (must stay within 100 m of punch-in spot)
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="active" defaultChecked={e ? !!e.active : true} /> Active (can log in)
          </label>
        </div>
      </Section>

      <div className="flex gap-3">
        <SubmitButton>{e ? "Save changes" : "Add employee"}</SubmitButton>
        <Link href="/employees" className="btn">Cancel</Link>
      </div>
    </ActionForm>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="card">
      <h2 className="font-semibold">{title}</h2>
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
