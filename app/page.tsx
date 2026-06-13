import { ArrowRight, Camera, Clapperboard, Layers, RadioTower, Sparkles, Video, Wand2 } from "lucide-react";

const features = [
  { icon: Clapperboard, title: "脚本拆解", desc: "把小说、广告、短剧或产品文案拆成可执行的镜头表。" },
  { icon: Layers, title: "转场知识库", desc: "遮挡、光影、动作、空间等稳定转场，附中文提示词。" },
  { icon: Camera, title: "镜头语言库", desc: "景别、角度、运镜和风格模板统一成可复制资产。" },
];

const workflow = ["输入原文", "诊断节奏", "生成分镜", "复制提示词"];

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden text-slate-100">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
        <a href="/" className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl border border-cyan-300/30 bg-cyan-300/10 text-cyan-200 shadow-neon">
            <Video className="h-5 w-5" />
          </div>
          <div>
            <div className="font-semibold text-white">AI Video Director</div>
            <div className="text-xs text-cyan-100/55">Script · Shot · Motion · Prompt</div>
          </div>
        </a>
        <div className="flex items-center gap-3">
          <a href="/login" className="muted-button rounded-xl px-4 py-2 text-sm font-medium">登录</a>
          <a href="/dashboard" className="primary-neon inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold">
            进入工作台 <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl items-center gap-10 px-6 pb-14 pt-12 lg:grid-cols-[1.05fr_0.95fr] lg:pb-24 lg:pt-20">
        <div>
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/8 px-4 py-2 text-sm font-medium text-cyan-100">
            <Sparkles className="h-4 w-4 text-cyan-200" /> AI 视频导演控制台
          </div>
          <h1 className="max-w-4xl text-5xl font-black leading-[1.05] text-white md:text-7xl">
            把一段文案变成可拍、可剪、可复制的分镜方案。
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-slate-300">
            面向 Veo、Seedance、Runway、Sora 等 AI 视频工具，自动整理剧情节奏、镜头语言、转场策略和首尾帧提示词。
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="/dashboard" className="primary-neon inline-flex items-center gap-2 rounded-xl px-6 py-4 font-semibold">
              生成分镜方案 <ArrowRight className="h-4 w-4" />
            </a>
            <a href="/library?type=transition" className="muted-button inline-flex items-center gap-2 rounded-xl px-6 py-4 font-semibold">
              查看转场库
            </a>
          </div>
        </div>

        <div className="glass-panel neon-border rounded-2xl p-4">
          <div className="rounded-xl border border-white/8 bg-slate-950/70 p-4">
            <div className="mb-4 flex items-center justify-between text-xs text-slate-400">
              <span className="inline-flex items-center gap-2"><RadioTower className="h-3.5 w-3.5 text-cyan-300" /> DIRECTOR FEED</span>
              <span>MOCK / AI READY</span>
            </div>
            <div className="rounded-xl border border-cyan-300/12 bg-black/30 p-4 text-sm leading-7 text-slate-200">
              一个男人在雨夜收到一张旧照片，发现照片里的人竟然是多年后死去的自己。他沿着照片背后的地址，走进一栋废弃大楼。
            </div>
            <div className="mt-4 grid gap-3">
              {workflow.map((item, index) => (
                <div key={item} className="flex items-center gap-3 rounded-xl border border-cyan-300/12 bg-cyan-300/[0.04] px-4 py-3 text-sm text-slate-200">
                  <span className="grid h-7 w-7 place-items-center rounded-lg bg-cyan-300/12 text-xs font-bold text-cyan-200">0{index + 1}</span>
                  {item}
                </div>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3 text-center text-xs text-slate-400">
              <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3"><b className="block text-lg text-white">5</b>镜头</div>
              <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3"><b className="block text-lg text-white">3</b>提示词</div>
              <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3"><b className="block text-lg text-white">AI</b>稳定</div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-4 px-6 pb-20 md:grid-cols-3">
        {features.map((feature) => {
          const Icon = feature.icon;
          return (
            <div key={feature.title} className="section-shell rounded-2xl p-6">
              <div className="mb-5 grid h-12 w-12 place-items-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-200">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-white">{feature.title}</h3>
              <p className="mt-2 text-sm leading-7 text-slate-400">{feature.desc}</p>
            </div>
          );
        })}
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-12">
        <div className="section-shell rounded-2xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase text-cyan-200/70">Next stage</p>
              <h2 className="mt-1 text-2xl font-bold text-white">从创作工具升级为真实 SaaS</h2>
            </div>
            <a href="/dashboard" className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/25 px-4 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-300/10">
              打开控制台 <Wand2 className="h-4 w-4" />
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
