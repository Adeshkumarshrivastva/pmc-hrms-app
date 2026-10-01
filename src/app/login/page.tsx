import Image from "next/image";
import { LoginForm } from "@/components/LoginForm";

const FEATURES = [
  {
    title: "One-tap punch in & out",
    text: "Mark attendance in seconds, with a live record of your day.",
    icon: "M12 6v6l4 2M12 21a9 9 0 100-18 9 9 0 000 18z",
  },
  {
    title: "Leaves, holidays & corrections",
    text: "Apply, track and get approvals without paperwork.",
    icon: "M8 7V3m8 4V3M4 11h16M5 5h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z",
  },
  {
    title: "Salary slips on demand",
    text: "Download your payslip as a PDF whenever you need it.",
    icon: "M9 12h6m-6 4h6M7 3h7l5 5v12a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z",
  },
];

export default function LoginPage() {
  return (
    <main className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel */}
      <aside className="relative hidden overflow-hidden bg-accent text-white lg:flex lg:flex-col lg:justify-between lg:p-14">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/[0.06]" />
        <div aria-hidden className="pointer-events-none absolute -bottom-32 -left-20 h-[28rem] w-[28rem] rounded-full bg-white/[0.05]" />
        <div aria-hidden className="pointer-events-none absolute bottom-40 right-10 h-40 w-40 rounded-full border border-white/10" />

        <Image src="/logo.png" width={190} height={71} alt="Positive Mind Care" unoptimized priority className="relative h-auto w-44" />

        <div className="relative max-w-md">
          <h1 className="text-4xl font-semibold leading-tight tracking-tight">
            Attendance &amp; payroll,<br />made simple.
          </h1>
          <p className="mt-4 text-base leading-relaxed text-white/70">
            Everything your team needs in one place — from the morning punch-in to the month-end salary slip.
          </p>
          <ul className="mt-10 space-y-6">
            {FEATURES.map((f) => (
              <li key={f.title} className="flex gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d={f.icon} />
                  </svg>
                </span>
                <span>
                  <span className="block font-medium">{f.title}</span>
                  <span className="mt-0.5 block text-sm text-white/65">{f.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/50">© {new Date().getFullYear()} Positive Mind Care and Research Centre Pvt. Ltd.</p>
      </aside>

      {/* Form panel */}
      <section className="flex flex-col bg-background">
        {/* Compact brand bar on phones and tablets */}
        <div className="bg-accent px-6 py-4 lg:hidden">
          <Image src="/logo.png" width={130} height={49} alt="Positive Mind Care" unoptimized priority className="h-auto w-32" />
        </div>

        <div className="flex flex-1 items-center justify-center px-6 py-10 sm:px-10">
          <div className="w-full max-w-[400px]">
            <div className="rounded-2xl border border-border bg-white p-7 shadow-[0_8px_30px_-12px_rgba(56,82,70,0.25)] sm:p-9">
              <LoginForm />
            </div>

            <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted">
              <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
                <path fillRule="evenodd" d="M10 1.5l6 2.4v4.7c0 4-2.6 7.6-6 8.9-3.4-1.3-6-4.9-6-8.9V3.9l6-2.4zm-1 9.7l4-4-1.1-1.1L9 9l-1.4-1.4L6.5 8.7 9 11.2z" clipRule="evenodd" />
              </svg>
              Secured with a one-time password
            </div>
            <p className="mt-2 text-center text-[11px] text-muted/80">Test mode · OTP is 628791</p>
          </div>
        </div>

        <p className="pb-6 text-center text-[11px] text-muted lg:hidden">
          © {new Date().getFullYear()} Positive Mind Care and Research Centre Pvt. Ltd.
        </p>
      </section>
    </main>
  );
}
