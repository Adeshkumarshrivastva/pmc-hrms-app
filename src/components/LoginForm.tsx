"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { sendOtpAction, verifyOtpAction, type FormState } from "@/app/actions";
import { SubmitButton } from "./SubmitButton";

const OTP_LENGTH = 6;
const RESEND_SECONDS = 30;

const errorBox = (msg?: string) =>
  msg && (
    <p role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
      <svg viewBox="0 0 20 20" className="mt-0.5 h-4 w-4 shrink-0" fill="currentColor" aria-hidden>
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9 6h2v5H9V6zm0 6h2v2H9v-2z" clipRule="evenodd" />
      </svg>
      <span>{msg}</span>
    </p>
  );

const primaryButton = "btn btn-primary w-full py-3 text-[15px] font-semibold shadow-sm";

/** Steps: mobile number -> OTP. */
export function LoginForm() {
  const [sendState, sendAction] = useActionState(sendOtpAction, {} as FormState);
  const [verifyState, verifyAction] = useActionState(verifyOtpAction, {} as FormState);
  const [changing, setChanging] = useState(false);
  const [otp, setOtp] = useState("");

  if (sendState.sent && !changing) {
    return (
      <OtpStep
        phone={sendState.phone ?? ""}
        otp={otp}
        setOtp={setOtp}
        error={verifyState.error}
        verifyAction={verifyAction}
        resend={sendAction}
        onChange={() => {
          setOtp("");
          setChanging(true);
        }}
      />
    );
  }

  return (
    <form
      action={(fd) => {
        setChanging(false);
        setOtp("");
        sendAction(fd);
      }}
      className="space-y-5"
    >
      <Heading title="Welcome back" subtitle="Sign in with the mobile number registered with your company." />
      <div>
        <label className="label" htmlFor="phone">Mobile number</label>
        <div className="flex rounded-lg shadow-sm">
          <span className="flex items-center rounded-l-lg border border-r-0 border-border bg-gray-50 px-3.5 text-sm font-medium text-gray-600">
            +91
          </span>
          <input
            id="phone" name="phone" type="tel" inputMode="numeric" autoComplete="tel-national" required autoFocus
            defaultValue={sendState.phone} placeholder="98765 43210" className="input rounded-l-none py-3 text-base tracking-wide"
          />
        </div>
      </div>
      {errorBox(sendState.error)}
      <SubmitButton className={primaryButton} pendingText="Sending OTP...">Send OTP</SubmitButton>
      <p className="text-center text-xs text-muted">We&apos;ll send a one-time password to verify it&apos;s you.</p>
    </form>
  );
}

function Heading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">{subtitle}</p>
    </div>
  );
}

function OtpStep({ phone, otp, setOtp, error, verifyAction, resend, onChange }: {
  phone: string;
  otp: string;
  setOtp: (v: string) => void;
  error?: string;
  verifyAction: (fd: FormData) => void;
  resend: (fd: FormData) => void;
  onChange: () => void;
}) {
  const [cooldown, setCooldown] = useState(RESEND_SECONDS);
  const [resent, setResent] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const resendOtp = () => {
    const fd = new FormData();
    fd.set("phone", phone);
    startTransition(() => resend(fd));
    setOtp("");
    setResent(true);
    setCooldown(RESEND_SECONDS);
  };

  return (
    <form action={verifyAction} className="space-y-5">
      <Heading
        title="Enter the OTP"
        subtitle={`We sent a ${OTP_LENGTH}-digit code to +91 ${phone}.`}
      />
      <button type="button" onClick={onChange} className="-mt-3 text-sm font-medium text-accent hover:underline">
        Use a different number
      </button>

      <OtpBoxes value={otp} onChange={setOtp} invalid={!!error} />
      <input type="hidden" name="otp" value={otp} />

      {errorBox(error)}
      {resent && !error && cooldown > 0 && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">A new OTP has been sent.</p>
      )}

      <SubmitButton className={primaryButton} pendingText="Verifying..." disabled={otp.length !== OTP_LENGTH}>
        Verify &amp; sign in
      </SubmitButton>

      <p className="text-center text-sm text-muted">
        Didn&apos;t get it?{" "}
        {cooldown > 0 ? (
          <span>Resend in {cooldown}s</span>
        ) : (
          <button type="button" onClick={resendOtp} className="font-medium text-accent hover:underline">Resend OTP</button>
        )}
      </p>
    </form>
  );
}

/** Six single-digit boxes with auto-advance, backspace and paste support. */
function OtpBoxes({ value, onChange, invalid }: { value: string; onChange: (v: string) => void; invalid: boolean }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length: OTP_LENGTH }, (_, i) => value[i] ?? "");

  const set = (i: number, digit: string) => {
    const next = digits.slice();
    next[i] = digit;
    onChange(next.join("").slice(0, OTP_LENGTH));
  };

  return (
    <div className="flex justify-between gap-2" role="group" aria-label="One-time password">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={d}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          autoFocus={i === 0}
          maxLength={1}
          aria-label={`Digit ${i + 1}`}
          onChange={(e) => {
            const digit = e.target.value.replace(/\D/g, "").slice(-1);
            set(i, digit);
            if (digit && i < OTP_LENGTH - 1) refs.current[i + 1]?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !digits[i] && i > 0) {
              set(i - 1, "");
              refs.current[i - 1]?.focus();
            } else if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
            else if (e.key === "ArrowRight" && i < OTP_LENGTH - 1) refs.current[i + 1]?.focus();
          }}
          onPaste={(e) => {
            const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
            if (!pasted) return;
            e.preventDefault();
            onChange(pasted);
            refs.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus();
          }}
          onFocus={(e) => e.target.select()}
          className={`h-13 w-full min-w-0 rounded-lg border bg-white text-center font-mono text-xl font-semibold shadow-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25 ${
            invalid ? "border-red-400 bg-red-50/40" : d ? "border-accent/60" : "border-border"
          }`}
        />
      ))}
    </div>
  );
}
