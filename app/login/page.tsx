"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import { Mail, Video } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function signIn() {
    setLoading(true);
    setMessage("");
    const supabase = createClient();
    if (!supabase) {
      setMessage("请先在 .env.local 配置 Supabase URL 和 Anon Key。当前项目仍可使用 mock 模式体验核心功能。");
      setLoading(false);
      return;
    }
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/dashboard` },
    });
    setMessage(error ? error.message : "登录链接已发送到邮箱。请打开邮箱完成登录。");
    setLoading(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="glass-panel neon-border w-full max-w-md rounded-2xl p-8">
        <a href="/" className="mb-8 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl border border-cyan-300/30 bg-cyan-300/10 text-cyan-200 shadow-neon">
            <Video className="h-5 w-5" />
          </div>
          <div>
            <div className="font-bold text-white">AI Video Director</div>
            <div className="text-xs text-cyan-100/55">登录 / 注册</div>
          </div>
        </a>
        <h1 className="text-3xl font-black text-white">邮箱登录</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          第一版使用 Supabase Magic Link，后续可升级为密码登录、Google 登录或微信登录。
        </p>
        <div className="relative mt-6">
          <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-200/55" />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="你的邮箱"
            className="control-input w-full rounded-xl py-3 pl-11 pr-4"
          />
        </div>
        <button onClick={signIn} disabled={loading} className="primary-neon mt-4 w-full rounded-xl px-5 py-4 font-bold disabled:cursor-not-allowed disabled:opacity-60">
          {loading ? "发送中..." : "发送登录链接"}
        </button>
        {message && <p className="mt-4 rounded-xl border border-cyan-300/12 bg-cyan-300/[0.04] p-4 text-sm leading-6 text-slate-300">{message}</p>}
      </div>
    </main>
  );
}
