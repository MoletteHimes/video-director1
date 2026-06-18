"use client";

import { Camera, Film, FolderOpen, Layers, Sparkles, Wand2 } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";

type NavItem = {
  href: string;
  name: string;
  icon: typeof Sparkles;
  type?: string;
};

const nav: NavItem[] = [
  { href: "/dashboard", name: "工作台", icon: Sparkles },
  { href: "/projects", name: "我的项目", icon: FolderOpen },
  { href: "/library?type=transition", name: "转场", icon: Layers, type: "transition" },
  { href: "/library?type=shot", name: "景别", icon: Camera, type: "shot" },
  { href: "/library?type=camera_movement", name: "运镜", icon: Film, type: "camera_movement" },
  { href: "/library?type=style", name: "风格", icon: Wand2, type: "style" },
];

function isActiveNavItem(item: NavItem, pathname: string, selectedType: string | null) {
  if (item.type) return pathname === "/library" && selectedType === item.type;
  return pathname === item.href;
}

export function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedType = searchParams.get("type");

  return (
    <aside className="group/sidebar fixed left-5 top-1/2 z-40 hidden w-[4.25rem] -translate-y-1/2 overflow-hidden rounded-[1.75rem] border border-white/10 bg-black/[0.58] p-3 shadow-[0_20px_70px_rgba(0,0,0,0.46)] backdrop-blur-2xl transition-[width,background,border-color] duration-300 hover:w-48 hover:border-violet-300/[0.24] hover:bg-black/[0.72] lg:block">
      <a href="/" className="mb-5 flex h-11 items-center gap-3 rounded-full text-white">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-violet-500 text-sm font-black shadow-[0_0_24px_rgba(139,92,246,0.5)]">
          用
        </span>
        <span className="w-0 overflow-hidden whitespace-nowrap text-sm font-bold opacity-0 transition-all duration-300 group-hover/sidebar:w-48 group-hover/sidebar:opacity-100">
          AI Video Director
        </span>
      </a>

      <nav className="space-y-2">
        {nav.map((item) => {
          const Icon = item.icon;
          const active = isActiveNavItem(item, pathname, selectedType);
          return (
            <a
              key={item.name}
              href={item.href}
              title={item.name}
              className={`flex h-11 items-center gap-3 rounded-2xl px-3 text-sm font-semibold transition ${
                active
                  ? "bg-violet-400 text-white shadow-[0_0_24px_rgba(139,92,246,0.55)]"
                  : "text-slate-400 hover:bg-white/[0.08] hover:text-slate-100"
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-300 group-hover/sidebar:w-24 group-hover/sidebar:opacity-100">
                {item.name}
              </span>
            </a>
          );
        })}
      </nav>
    </aside>
  );
}
