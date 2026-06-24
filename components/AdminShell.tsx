"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { FolderOpen, Layers, LayoutDashboard, Loader2, ShieldCheck, Users } from "lucide-react";

type GateState = "loading" | "forbidden" | "ready";

type AdminUser = {
  id?: string;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
  plan?: string | null;
};

const navItems = [
  { name: "仪表盘", href: "/admin", icon: LayoutDashboard, ready: true },
  { name: "用户管理", href: "/admin/users", icon: Users, ready: true },
  { name: "项目管理", href: "/admin/projects", icon: FolderOpen, ready: false },
  { name: "素材库", href: "/admin/library", icon: Layers, ready: false },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GateState>("loading");
  const [user, setUser] = useState<AdminUser | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    let active = true;
    fetch("/api/auth/me", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!active) return;
        const me: AdminUser | null = response.ok && data?.ok ? data.user || null : null;
        if (me && me.role === "ADMIN") {
          setUser(me);
          setState("ready");
        } else {
          setState("forbidden");
          window.location.href = "/login?next=/admin";
        }
      })
      .catch(() => {
        if (!active) return;
        setState("forbidden");
        window.location.href = "/login?next=/admin";
      });
    return () => {
      active = false;
    };
  }, []);

  if (state !== "ready") {
    return (
      <main className="grid min-h-screen place-items-center text-slate-300">
        <div className="inline-flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/60 px-5 py-4 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          {state === "forbidden" ? "需要管理员权限，正在跳转登录..." : "正在校验管理员身份..."}
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen text-slate-100">
      <div className="grid min-h-screen grid-cols-[220px_1fr]">
        <aside className="flex flex-col border-r border-white/10 bg-slate-950/70 p-4">
          <div className="mb-6 flex items-center gap-2 px-2 text-sm font-black text-white">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-violet-500 text-white shadow-[0_0_18px_rgba(139,92,246,0.45)]">
              <ShieldCheck className="h-4 w-4" />
            </span>
            运营后台
          </div>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              if (!item.ready) {
                return (
                  <span
                    key={item.name}
                    className="flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-500"
                  >
                    <span className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      {item.name}
                    </span>
                    <span className="rounded-md border border-white/10 px-1.5 py-0.5 text-[10px]">待开发</span>
                  </span>
                );
              }
              return (
                <a
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                    active ? "bg-violet-400/20 text-white" : "text-slate-300 hover:bg-white/[0.06]"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.name}
                </a>
              );
            })}
          </nav>
          <div className="mt-auto truncate px-2 pt-6 text-xs text-slate-500">
            {user?.email || user?.phone || user?.id}
          </div>
        </aside>
        <section className="p-8">{children}</section>
      </div>
    </div>
  );
}
