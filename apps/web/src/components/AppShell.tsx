"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ActorSelector } from "./ActorSelector";

type NavItem = { href: string; label: string; soon?: boolean };

const NAV: NavItem[] = [
  { href: "/intakes",     label: "Intakes"       },
  { href: "/intakes/new", label: "Create Intake"  },
  { href: "#reports",     label: "Reports",  soon: true },
  { href: "#settings",    label: "Settings", soon: true },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex h-screen overflow-hidden bg-canvas">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 bg-sidebar flex flex-col overflow-y-auto">
        <div className="px-5 py-5 border-b border-slate-700">
          <p className="text-xs font-semibold text-indigo-400 uppercase tracking-widest mb-0.5">
            Project Intake OS
          </p>
          <p className="text-xs text-slate-400">Operational Control</p>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5" aria-label="Main navigation">
          {NAV.map((item) =>
            item.soon ? (
              <div
                key={item.href}
                className="flex items-center justify-between px-3 py-2 rounded-lg text-sm text-slate-500 cursor-not-allowed"
              >
                <span>{item.label}</span>
                <span className="text-xs bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded">
                  Soon
                </span>
              </div>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center px-3 py-2 rounded-lg text-sm transition-colors
                  ${
                    pathname === item.href ||
                    (item.href !== "/" && pathname.startsWith(item.href) && item.href !== "/intakes/new")
                      ? "bg-indigo-600 text-white"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  }
                `}
              >
                {item.label}
              </Link>
            ),
          )}
        </nav>

        <ActorSelector />
      </aside>

      {/* Main canvas */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
