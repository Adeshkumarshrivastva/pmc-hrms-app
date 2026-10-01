"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLinks({ links }: { links: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto sm:justify-center [scrollbar-width:none]">
      {links.map((l) => {
        const active = pathname === l.href || pathname.startsWith(l.href + "/");
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`relative whitespace-nowrap rounded-lg px-3 py-2 text-[13.5px] font-medium transition-all duration-200 ${
              active
                ? "bg-white/15 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)] after:absolute after:inset-x-3.5 after:-bottom-[9px] after:h-[3px] after:rounded-t-full after:bg-white"
                : "text-white/70 hover:bg-white/10 hover:text-white"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
