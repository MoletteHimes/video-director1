"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Copy, Download, Edit3, FileText, Image as ImageIcon, Loader2, RefreshCw } from "lucide-react";

type ProjectSummary = {
  id: string;
  title: string;
  content_type?: string | null;
  style?: string | null;
  duration?: string | null;
  status: string;
  created_at: string;
};

type ProjectShot = {
  id: string;
  shotNumber: number;
  scene?: string | null;
  visual?: string | null;
  shotType?: string | null;
  cameraMovement?: string | null;
  emotion?: string | null;
  transition?: string | null;
  firstFramePrompt?: string | null;
  videoPrompt?: string | null;
  lastFramePrompt?: string | null;
  negativePrompt?: string | null;
};

type ProjectVersion = {
  id: string;
  versionNumber: number;
  title: string;
  originalScript: string;
  optimizedScript?: string | null;
  contentType?: string | null;
  style?: string | null;
  duration?: string | null;
  status: string;
  storyboardImageUrl?: string | null;
  storyboardImagePrompt?: string | null;
  fullVideoPrompt?: string | null;
  createdAt: string;
  shots: ProjectShot[];
};

type ProjectDetail = {
  id: string;
  title: string;
  originalScript: string;
  optimizedScript?: string | null;
  contentType?: string | null;
  style?: string | null;
  duration?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  versions: ProjectVersion[];
};

function formatDate(value?: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getStatusLabel(status: string) {
  if (status === "draft") return "草稿";
  if (status === "completed") return "已完成";
  if (status === "failed") return "失败";
  return status || "未知";
}

function getFriendlyProjectError(message: string) {
  if (/endpoint is unavailable|Cannot GET|Not Found/i.test(message)) {
    return "项目详情接口暂时不可用。请重启 Nest API 后刷新页面，或者点击下方重试。";
  }
  if (/Unauthorized/i.test(message)) return "请先登录后查看项目。";
  return message || "项目详情加载失败，请稍后再试。";
}

function buildPromptText(version: ProjectVersion) {
  if (version.fullVideoPrompt) return version.fullVideoPrompt;

  const shots = version.shots
    .map((shot) =>
      [
        `${shot.shotNumber}. ${shot.scene || "镜头"}`,
        `画面：${shot.visual || "-"}`,
        `景别：${shot.shotType || "-"}`,
        `运镜：${shot.cameraMovement || "-"}`,
        `情绪：${shot.emotion || "-"}`,
        `转场：${shot.transition || "-"}`,
        `视频提示词：${shot.videoPrompt || "-"}`,
      ].join("\n"),
    )
    .join("\n\n");

  return [
    `标题：${version.title}`,
    `时长：${version.duration || "-"}`,
    `风格：${version.style || "-"}`,
    `原始文案：\n${version.originalScript}`,
    version.optimizedScript ? `优化文案：\n${version.optimizedScript}` : "",
    `镜头表：\n${shots}`,
  ].filter(Boolean).join("\n\n");
}

export function ProjectsClient() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState("");
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [listError, setListError] = useState("");
  const [projectDetailError, setProjectDetailError] = useState("");

  const selectedVersion = useMemo(() => {
    if (!project) return null;
    return project.versions.find((version) => version.id === selectedVersionId) || project.versions[0] || null;
  }, [project, selectedVersionId]);

  useEffect(() => {
    let active = true;
    setLoadingList(true);
    setListError("");

    fetch("/api/projects", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        if (!data.ok) throw new Error(data.error || "项目列表加载失败");
        const items = Array.isArray(data.projects) ? data.projects : [];
        setProjects(items);
        if (items[0]?.id) setSelectedProjectId(items[0].id);
      })
      .catch((err) => {
        if (active) setListError(err.message || "项目列表加载失败");
      })
      .finally(() => {
        if (active) setLoadingList(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function reloadSelectedProject(projectId = selectedProjectId) {
    if (!projectId) {
      setProject(null);
      setProjectDetailError("");
      return;
    }

    setLoadingDetail(true);
    setProjectDetailError("");
    try {
      const res = await fetch(`/api/projects/${projectId}`, { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(data?.error || "项目详情加载失败");
      setProject(data.project || null);
      setSelectedVersionId(data.project?.versions?.[0]?.id || "");
    } catch (err) {
      setProject(null);
      setProjectDetailError(getFriendlyProjectError(err instanceof Error ? err.message : "项目详情加载失败"));
    } finally {
      setLoadingDetail(false);
    }
  }

  useEffect(() => {
    void reloadSelectedProject(selectedProjectId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProjectId]);

  function resumeEditing() {
    if (!project || !selectedVersion) return;
    window.localStorage.setItem("vd_resume_script", selectedVersion.originalScript || project.originalScript || "");
    window.localStorage.setItem("vd_resume_project_id", project.id);
    window.location.href = "/dashboard";
  }

  async function copyPrompt() {
    if (!selectedVersion) return;
    await navigator.clipboard.writeText(buildPromptText(selectedVersion));
  }

  async function downloadDocx() {
    if (!selectedVersion) return;
    const res = await fetch("/api/prompt-docx", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `${selectedVersion.title}-v${selectedVersion.versionNumber}`,
        sections: [{
          heading: `${selectedVersion.title} v${selectedVersion.versionNumber}`,
          originalText: selectedVersion.originalScript,
          promptText: buildPromptText(selectedVersion),
        }],
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setProjectDetailError(data?.error || "DOCX 下载失败");
      return;
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${selectedVersion.title}-v${selectedVersion.versionNumber}.docx`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="relative min-h-[calc(100vh-4rem)] text-slate-100">
      <div className="mb-5 rounded-2xl border border-cyan-300/14 bg-slate-950/70 p-5 shadow-[0_20px_70px_rgba(0,0,0,0.24)] backdrop-blur-xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-2 text-xs uppercase tracking-wide text-cyan-200/70">Project History</div>
            <h1 className="text-3xl font-black text-white">我的项目</h1>
            <p className="mt-2 text-sm text-slate-400">这里保存生成过的视频提示词、版本记录、镜头表和分镜图。</p>
          </div>
          <a href="/dashboard" className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/18 bg-cyan-300/10 px-4 py-2 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-300/16">
            <Edit3 className="h-4 w-4" />
            新建生成
          </a>
        </div>
      </div>

      {listError && (
        <div className="mb-4 rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-100">
          {listError === "Unauthorized" ? (
            <span>请先登录后查看项目。<a className="ml-2 font-semibold text-cyan-100 underline" href="/login">去登录</a></span>
          ) : listError}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
        <section className="rounded-2xl border border-cyan-300/12 bg-slate-950/58 p-3 backdrop-blur-xl">
          <div className="mb-3 flex items-center justify-between px-2">
            <h2 className="font-bold text-white">项目列表</h2>
            {loadingList && <Loader2 className="h-4 w-4 animate-spin text-cyan-100" />}
          </div>

          {!loadingList && !projects.length && (
            <div className="rounded-xl border border-dashed border-cyan-300/16 bg-slate-950/60 p-4 text-sm leading-6 text-slate-400">
              还没有保存的项目。去工作台生成一次后，这里会自动出现历史记录。
            </div>
          )}

          <div className="space-y-2">
            {projects.map((item) => {
              const active = item.id === selectedProjectId;
              return (
                <button
                  key={item.id}
                  onClick={() => setSelectedProjectId(item.id)}
                  className={`w-full rounded-xl border p-3 text-left transition ${
                    active
                      ? "border-cyan-200/50 bg-cyan-300/[0.09]"
                      : "border-white/8 bg-white/[0.03] hover:border-cyan-300/22 hover:bg-cyan-300/[0.05]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-bold text-white">{item.title}</div>
                      <div className="mt-1 text-xs text-slate-500">{item.content_type || "自动分类"} · {item.duration || "-"}</div>
                    </div>
                    <span className="shrink-0 rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-slate-400">{getStatusLabel(item.status)}</span>
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                    <CalendarClock className="h-3.5 w-3.5" />
                    {formatDate(item.created_at)}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="min-h-[520px] rounded-2xl border border-cyan-300/12 bg-slate-950/58 p-5 backdrop-blur-xl">
          {loadingDetail && (
            <div className="flex h-80 items-center justify-center gap-3 text-sm text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin text-cyan-100" />
              正在加载项目详情...
            </div>
          )}

          {!loadingDetail && projectDetailError && (
            <div className="flex min-h-[420px] items-center justify-center">
              <div className="max-w-md rounded-2xl border border-red-400/20 bg-red-500/10 p-5 text-sm leading-7 text-red-50">
                <div className="mb-2 font-bold text-white">项目详情加载失败</div>
                <p>{projectDetailError}</p>
                <button
                  type="button"
                  onClick={() => reloadSelectedProject()}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl border border-red-200/20 bg-white/[0.04] px-3 py-2 font-semibold text-white transition hover:bg-white/[0.08]"
                >
                  <RefreshCw className="h-4 w-4" />
                  重试
                </button>
              </div>
            </div>
          )}

          {!loadingDetail && !projectDetailError && !project && projects.length > 0 && (
            <div className="flex h-80 items-center justify-center rounded-xl border border-dashed border-cyan-300/16 bg-slate-950/40 text-sm text-slate-500">
              请选择左侧项目查看详情。
            </div>
          )}

          {!loadingDetail && !projectDetailError && project && selectedVersion && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-xs uppercase tracking-wide text-cyan-200/70">Saved Project</div>
                  <h2 className="mt-1 text-2xl font-black text-white">{project.title}</h2>
                  <p className="mt-2 text-sm text-slate-500">{project.contentType || "自动分类"} · {project.style || "自动风格"} · {project.duration || "-"}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={resumeEditing} className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/18 bg-cyan-300/10 px-3 py-2 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-300/16">
                    <RefreshCw className="h-4 w-4" />
                    继续编辑
                  </button>
                  <button onClick={copyPrompt} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.08]">
                    <Copy className="h-4 w-4" />
                    复制提示词
                  </button>
                  <button onClick={downloadDocx} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.08]">
                    <Download className="h-4 w-4" />
                    下载 DOCX
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {project.versions.map((version) => (
                  <button
                    key={version.id}
                    onClick={() => setSelectedVersionId(version.id)}
                    className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                      version.id === selectedVersion.id
                        ? "border-cyan-200/50 bg-cyan-300/[0.11] text-cyan-50"
                        : "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.08]"
                    }`}
                  >
                    版本 v{version.versionNumber}
                    <span className="ml-2 text-xs text-slate-500">{formatDate(version.createdAt)}</span>
                  </button>
                ))}
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-bold text-white">
                    <FileText className="h-4 w-4 text-cyan-100" />
                    生成文案
                  </div>
                  <div className="max-h-56 overflow-auto whitespace-pre-wrap text-sm leading-7 text-slate-300">
                    {selectedVersion.optimizedScript || selectedVersion.originalScript}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-bold text-white">
                    <ImageIcon className="h-4 w-4 text-cyan-100" />
                    分镜图
                  </div>
                  {selectedVersion.storyboardImageUrl ? (
                    <div className="max-h-72 overflow-auto rounded-xl border border-white/10 bg-black/30">
                      <img src={selectedVersion.storyboardImageUrl} alt="项目分镜图" className="mx-auto w-full max-w-3xl" />
                    </div>
                  ) : (
                    <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-cyan-300/16 bg-slate-950/60 px-4 text-center text-sm text-slate-500">
                      这个版本还没有生成分镜图，但提示词和镜头表已经保存。
                    </div>
                  )}
                </div>
              </div>

              {selectedVersion.fullVideoPrompt && (
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-bold text-white">
                    <FileText className="h-4 w-4 text-cyan-100" />
                    视频生成提示词
                  </div>
                  <div className="max-h-[560px] overflow-auto whitespace-pre-wrap text-sm leading-7 text-slate-300">
                    {selectedVersion.fullVideoPrompt}
                  </div>
                </div>
              )}

              <div className="overflow-x-auto rounded-2xl border border-cyan-300/12">
                <table className="w-full min-w-[980px] border-collapse text-left text-sm">
                  <thead className="bg-cyan-300/[0.06] text-xs uppercase text-cyan-100/70">
                    <tr>
                      <th className="p-3">镜头</th>
                      <th className="p-3">画面</th>
                      <th className="p-3">景别</th>
                      <th className="p-3">运镜</th>
                      <th className="p-3">情绪</th>
                      <th className="p-3">转场</th>
                      <th className="p-3">视频提示词</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedVersion.shots.map((shot) => (
                      <tr key={shot.id} className="border-t border-cyan-300/10 align-top text-slate-300">
                        <td className="p-3 font-bold text-cyan-100">{shot.shotNumber}</td>
                        <td className="max-w-[280px] p-3">{shot.visual || shot.scene || "-"}</td>
                        <td className="p-3 text-slate-400">{shot.shotType || "-"}</td>
                        <td className="p-3 text-slate-400">{shot.cameraMovement || "-"}</td>
                        <td className="p-3 text-slate-400">{shot.emotion || "-"}</td>
                        <td className="p-3 text-slate-400">{shot.transition || "-"}</td>
                        <td className="max-w-[360px] p-3 text-slate-400">{shot.videoPrompt || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
