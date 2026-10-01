import Image from "next/image";
import Link from "next/link";
import { logout } from "@/app/actions";
import { Avatar } from "@/components/Avatar";
import { NavLinks } from "@/components/NavLinks";
import { requireUser } from "@/lib/auth";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";

  const links = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/attendance", label: "Attendance" },
    { href: "/leaves", label: "Leaves" },
    { href: "/holidays", label: "Holidays" },
    ...(isAdmin
      ? [
          { href: "/employees", label: "Employees" },
          { href: "/location", label: "Location" },
          // { href: "/payroll", label: "Payroll" },
        ]
      : []),
    { href: "/payslips", label: "Salary Slips" },
    ...(isAdmin ? [{ href: "/reports", label: "Reports" }] : []),
  ];

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-black/20 bg-gradient-to-b from-accent to-accent/90 text-white shadow-md shadow-black/10 print:hidden">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2">
          <Link href="/dashboard" aria-label="Positive Mind Care" className="shrink-0 rounded-lg p-1 transition hover:bg-white/10">
            <Image src="/logo.png" width={85} height={32} alt="Positive Mind Care" unoptimized priority className="h-9 w-auto" />
          </Link>
          <span className="hidden h-6 w-px bg-white/20 sm:block" aria-hidden />
          <div className="order-last w-full sm:order-none sm:w-auto sm:min-w-0 sm:flex-1">
            <NavLinks links={links} />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/profile"
              className="flex items-center gap-2.5 rounded-full border border-white/15 bg-white/5 py-1 pl-1 pr-3.5 transition hover:border-white/30 hover:bg-white/10"
            >
              <Avatar name={user.name} size={30} />
              <span className="hidden text-left leading-tight sm:block">
                <span className="block max-w-32 truncate text-[13px] font-semibold">{user.name}</span>
                <span className="block text-[11px] text-white/65">{isAdmin ? "Admin" : user.designation || "Employee"}</span>
              </span>
            </Link>
            <form action={logout}>
              <button className="flex items-center gap-1.5 rounded-full border border-white/25 px-3.5 py-1.5 text-xs font-medium text-white transition hover:border-white/50 hover:bg-white/15">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
                </svg>
                Logout
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-5 print:max-w-none print:p-0">{children}</main>
    </div>
  );
}
