"use client";

import { ShieldCheck } from "lucide-react";
import { AdminShell } from "@/components/AdminShell";

export default function AdminHomePage() {
  return (
    <AdminShell>
      <div className="mb-2 text-xs uppercase tracking-wide text-cyan-200/70">Admin Console</div>
      <h1 className="text-3xl font-black text-white">运营后台</h1>
      <div className="mt-6 inline-flex items-center gap-3 rounded-2xl border border-cyan-300/14 bg-cyan-300/[0.06] px-5 py-4 text-sm text-cyan-50">
        <ShieldCheck className="h-5 w-5 text-cyan-200" />
        后台鉴权已就绪（NestJS JWT + role=ADMIN）。从左侧选择模块开始。
      </div>
      <p className="mt-6 max-w-xl text-sm leading-7 text-slate-400">
        当前已开放「用户管理」：可查看、搜索、改套餐 / 额度、禁用 / 启用、删除用户。项目管理与素材库将在后续步骤填充。
      </p>
    </AdminShell>
  );
}
