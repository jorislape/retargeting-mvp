"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";

const NAV = [
  { href: "/home", label: "Home" },
  { href: "/reports", label: "Reports" },
  { href: "/alerts", label: "Alerts" },
  { href: "/settings", label: "Settings" },
] as const;

export default function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-100 antialiased">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-52 flex-col border-r border-white/5 bg-zinc-950 px-3 py-4 sm:flex">
        <Link href="/home" className="flex items-center gap-2 px-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-sky-400 to-blue-600 text-xs font-black text-white">
            A
          </span>
          <span className="text-sm font-bold tracking-tight">AdReports</span>
        </Link>

        <nav className="mt-6 flex flex-col gap-0.5">
          {NAV.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-white/10 text-white"
                    : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <p className="mt-auto px-2 text-[10px] text-zinc-600">
          Synced live from Meta
        </p>
      </aside>

      <div className="flex-1 sm:pl-52">
        <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8">{children}</main>
      </div>
    </div>
  );
}
