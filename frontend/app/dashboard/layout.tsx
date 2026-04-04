"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Key,
  Layers,
  LayoutDashboard,
  List,
  Settings,
  Shield,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/runs", label: "Runs", icon: List },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/dashboard/alerts", label: "Alerts", icon: AlertTriangle },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="sidebar fixed left-0 top-0 z-40 flex flex-col py-5 px-4 overflow-y-auto">
        <Link href="/" className="flex items-center gap-2.5 px-3 mb-8">
          <Shield className="h-6 w-6 text-teal-400" />
          <span className="text-lg font-bold tracking-tight">Cordon</span>
        </Link>

        <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500 px-3 mb-3">
          Control Plane
        </div>

        <nav className="space-y-1">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`sidebar-link ${isActive ? "active" : ""}`}
              >
                <item.icon className="h-[18px] w-[18px]" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto pt-6">
          <div className="rounded-xl border border-white/6 bg-white/3 p-4 text-xs text-slate-400">
            <div className="flex items-center gap-2 text-teal-400 font-medium mb-2">
              <Activity className="h-3.5 w-3.5" />
              System Status
            </div>
            <div>Backend: <span className="text-teal-300">Connected</span></div>
            <div className="mt-0.5">Auth: <span className="text-slate-300">Open Mode</span></div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 ml-[260px] min-h-screen p-6 md:p-8">
        {children}
      </main>
    </div>
  );
}
