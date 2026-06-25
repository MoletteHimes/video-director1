"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  Copy,
  Download,
  Edit3,
  FileText,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Trash2,
} from "lucide-react";

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
  qualityCheck?: Record<string, unknown> | null;
  createdAt: string;
  shots: ProjectShot[];
};

type CharacterProfile = {
  id: string;
  name: string;
  role?: string | null;
  appearance?: string | null;
  personality?: string | null;
  relationshipState?: string | null;
  visualLock?: string | null;
  importance: number;
  locked: boolean;
};

type StoryLoop = {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  importance: number;
};

type MemoryItem = {
  id: string;
  type: string;
  title?: string | null;
  content: string;
  importance: number;
  recency: number;
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
  storyBible?: Record<string, unknown> | null;
  contextSummary?: string | null;
  stateVector?: Record<string, unknown> | null;
  openLoops?: unknown[] | null;
  characterProfiles?: CharacterProfile[];
  storyLoops?: StoryLoop[];
  memoryItems?: MemoryItem[];
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

function getFriendlyProjectError(message: string) {
  if (/endpoint is unavailable|Cannot GET|Not Found/i.test(message)) {
    return "项目详情接口暂时不可用。请重启 Nest API 后刷新页面。";
  }
  if (/Unauthorized/i.test(message)) return "请先登录后查看项目。";
  return message || "项目详情加载失败，请稍后再试。";
}

function formatJson(value: unknown) {
  if (!value || typeof value !== "object") return "{}";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "{}";
  }
}

function parseJsonOrThrow(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    throw new Error("JSON 格式不正确");
  }
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
    version.optimizedScript ? `生成文案：\n${version.optimizedScript}` : "",
    `镜头表：\n${shots}`,
  ]
    .filter(Boolean)
    .join("\n\n");
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
  const [deleteMode, setDeleteMode] = useState(false);
  const [checkedProjectIds, setCheckedProjectIds] = useState<string[]>([]);
  const [deletingProjects, setDeletingProjects] = useState(false);
  const [deletingEpisode, setDeletingEpisode] = useState(false);

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
    window.localStorage.setItem("vd_resume_version_id", selectedVersion.id);
    window.location.href = "/dashboard";
  }

  function startNewEpisode() {
    if (project?.id) {
      window.localStorage.setItem("vd_resume_project_id", project.id);
    } else {
      window.localStorage.removeItem("vd_resume_project_id");
    }
    window.localStorage.removeItem("vd_resume_script");
    window.localStorage.removeItem("vd_resume_version_id");
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
        title: `${selectedVersion.title}-第${selectedVersion.versionNumber}集`,
        sections: [
          {
            heading: `${selectedVersion.title} 第${selectedVersion.versionNumber}集`,
            originalText: selectedVersion.originalScript,
            promptText: buildPromptText(selectedVersion),
          },
        ],
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
    link.download = `${selectedVersion.title}-第${selectedVersion.versionNumber}集.docx`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function toggleProjectChecked(projectId: string) {
    setCheckedProjectIds((ids) =>
      ids.includes(projectId) ? ids.filter((id) => id !== projectId) : [...ids, projectId],
    );
  }

  function handleProjectClick(projectId: string) {
    if (deleteMode) {
      toggleProjectChecked(projectId);
      return;
    }
    setSelectedProjectId(projectId);
  }

  async function deleteCheckedProjects() {
    if (!deleteMode) {
      setDeleteMode(true);
      setCheckedProjectIds([]);
      return;
    }

    if (!checkedProjectIds.length) {
      setDeleteMode(false);
      return;
    }

    if (!window.confirm(`确定彻底删除 ${checkedProjectIds.length} 个项目吗？`)) return;

    setDeletingProjects(true);
    setListError("");
    try {
      await Promise.all(
        checkedProjectIds.map(async (projectId) => {
          const res = await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
          const data = await res.json().catch(() => null);
          if (!res.ok || !data?.ok) throw new Error(data?.error || "项目删除失败");
        }),
      );

      const remainingProjects = projects.filter((item) => !checkedProjectIds.includes(item.id));
      const nextSelectedId =
        remainingProjects.find((item) => item.id === selectedProjectId)?.id || remainingProjects[0]?.id || "";

      setProjects(remainingProjects);
      setCheckedProjectIds([]);
      setDeleteMode(false);
      setSelectedProjectId(nextSelectedId);
      if (!nextSelectedId) {
        setProject(null);
        setSelectedVersionId("");
        setProjectDetailError("");
      }
    } catch (err) {
      setListError(err instanceof Error ? err.message : "项目删除失败");
    } finally {
      setDeletingProjects(false);
    }
  }

  async function deleteSelectedEpisode() {
    if (!project || !selectedVersion) return;
    if (!window.confirm(`确定删除第 ${selectedVersion.versionNumber} 集吗？后面的集数会自动补位。`)) return;

    setDeletingEpisode(true);
    setProjectDetailError("");
    try {
      const res = await fetch(`/api/projects/${project.id}?versionId=${selectedVersion.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(data?.error || "剧集删除失败");
      await reloadSelectedProject(project.id);
    } catch (err) {
      setProjectDetailError(err instanceof Error ? err.message : "剧集删除失败");
    } finally {
      setDeletingEpisode(false);
    }
  }

  async function patchProjectSubPath(subPath: string, body: Record<string, unknown>) {
    if (!project) return;
    setProjectDetailError("");
    const res = await fetch(`/api/projects/${project.id}/${subPath}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) throw new Error(data?.error || "记忆更新失败");
    await reloadSelectedProject(project.id);
  }

  async function editStoryBible() {
    if (!project) return;
    const next = window.prompt("编辑 storyBible JSON", formatJson(project.storyBible || {}));
    if (next === null) return;
    try {
      await patchProjectSubPath("memory", { storyBible: parseJsonOrThrow(next) });
    } catch (err) {
      setProjectDetailError(err instanceof Error ? err.message : "记忆更新失败");
    }
  }

  async function editCharacter(character: CharacterProfile) {
    if (!project) return;
    const next = window.prompt("编辑角色视觉锁定", character.visualLock || character.appearance || "");
    if (next === null) return;
    try {
      await patchProjectSubPath(`characters/${character.id}`, { visualLock: next, locked: true });
    } catch (err) {
      setProjectDetailError(err instanceof Error ? err.message : "角色更新失败");
    }
  }

  async function resolveStoryLoop(loop: StoryLoop) {
    if (!project) return;
    try {
      await patchProjectSubPath(`story-loops/${loop.id}`, { status: "RESOLVED" });
    } catch (err) {
      setProjectDetailError(err instanceof Error ? err.message : "伏笔更新失败");
    }
  }

  async function disableMemory(memory: MemoryItem) {
    if (!project) return;
    try {
      await patchProjectSubPath(`memories/${memory.id}`, { isEnabled: false });
    } catch (err) {
      setProjectDetailError(err instanceof Error ? err.message : "记忆更新失败");
    }
  }

  return (
    <div className="relative min-h-[calc(100vh-4rem)] text-slate-100">
      <div className="mb-5 rounded-2xl border border-cyan-300/14 bg-slate-950/70 p-5 shadow-[0_20px_70px_rgba(0,0,0,0.24)] backdrop-blur-xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-2 text-xs uppercase tracking-wide text-cyan-200/70">Project History</div>
            <h1 className="text-3xl font-black text-white">我的项目</h1>
            <p className="mt-2 text-sm text-slate-400">
              这里保存生成过的视频提示词、剧集记录、镜头表、分镜图和导演记忆。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={deleteCheckedProjects}
              disabled={deletingProjects}
              className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                deleteMode
                  ? "border-red-300/30 bg-red-500/15 text-red-50 hover:bg-red-500/20"
                  : "border-white/10 bg-white/[0.04] text-slate-100 hover:bg-white/[0.08]"
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              {deletingProjects ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {deleteMode ? (checkedProjectIds.length ? `删除 ${checkedProjectIds.length}` : "取消删除") : "删除"}
            </button>
            <button
              type="button"
              onClick={startNewEpisode}
              className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/18 bg-cyan-300/10 px-4 py-2 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-300/16"
            >
              <Edit3 className="h-4 w-4" />
              新建生成
            </button>
          </div>
        </div>
      </div>

      {listError && (
        <div className="mb-4 rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-100">
          {listError === "Unauthorized" ? (
            <span>
              请先登录后查看项目。
              <a className="ml-2 font-semibold text-cyan-100 underline" href="/login">
                去登录
              </a>
            </span>
          ) : (
            listError
          )}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
        <section className="rounded-2xl border border-cyan-300/12 bg-slate-950/58 p-3 backdrop-blur-xl">
          <div className="mb-3 flex items-center justify-between px-2">
            <h2 className="font-bold text-white">项目列表</h2>
            {loadingList && <Loader2 className="h-4 w-4 animate-spin text-cyan-100" />}
          </div>

          {deleteMode && (
            <p className="mb-3 px-2 text-xs text-red-100/75">
              删除模式：点击项目右侧的框勾选，再点击顶部删除。
            </p>
          )}

          {!loadingList && !projects.length && (
            <div className="rounded-xl border border-dashed border-cyan-300/16 bg-slate-950/60 p-4 text-sm leading-6 text-slate-400">
              还没有保存的项目。去工作台生成一次后，这里会自动出现历史记录。
            </div>
          )}

          <div className="space-y-2">
            {projects.map((item) => {
              const active = item.id === selectedProjectId;
              const checked = checkedProjectIds.includes(item.id);
              return (
                <button
                  key={item.id}
                  onClick={() => handleProjectClick(item.id)}
                  className={`w-full rounded-xl border p-3 text-left transition ${
                    active
                      ? "border-cyan-200/50 bg-cyan-300/[0.09]"
                      : "border-white/8 bg-white/[0.03] hover:border-cyan-300/22 hover:bg-cyan-300/[0.05]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-bold text-white">{item.title}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {item.content_type || "自动分类"} · {item.duration || "-"}
                      </div>
                    </div>
                    {deleteMode && (
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border text-xs font-bold ${
                          checked
                            ? "border-cyan-200/50 bg-cyan-300/25 text-cyan-50"
                            : "border-white/15 bg-white/[0.03] text-transparent"
                        }`}
                      >
                        ✓
                      </span>
                    )}
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
                  <p className="mt-2 text-sm text-slate-500">
                    {project.contentType || "自动分类"} · {project.style || "自动风格"} · {project.duration || "-"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={resumeEditing}
                    className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/18 bg-cyan-300/10 px-3 py-2 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-300/16"
                  >
                    <RefreshCw className="h-4 w-4" />
                    继续编辑
                  </button>
                  <button
                    onClick={startNewEpisode}
                    className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.08]"
                  >
                    <Edit3 className="h-4 w-4" />
                    新建一集
                  </button>
                  <button
                    onClick={deleteSelectedEpisode}
                    disabled={deletingEpisode}
                    className="inline-flex items-center gap-2 rounded-xl border border-red-300/20 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-50 transition hover:bg-red-500/16 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {deletingEpisode ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    删除本集
                  </button>
                  <button
                    onClick={copyPrompt}
                    className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.08]"
                  >
                    <Copy className="h-4 w-4" />
                    复制提示词
                  </button>
                  <button
                    onClick={downloadDocx}
                    className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.08]"
                  >
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
                    第 {version.versionNumber} 集
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
                      <img
                        src={selectedVersion.storyboardImageUrl}
                        alt="项目分镜图"
                        className="mx-auto w-full max-w-3xl"
                      />
                    </div>
                  ) : (
                    <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-cyan-300/16 bg-slate-950/60 px-4 text-center text-sm text-slate-500">
                      这一集还没有生成分镜图，但提示词和镜头表已经保存。
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

              <div className="rounded-2xl border border-cyan-300/12 bg-black/20 p-4">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-cyan-200/70">Director Memory</div>
                    <h3 className="mt-1 text-lg font-black text-white">导演记忆</h3>
                  </div>
                  <button
                    type="button"
                    onClick={editStoryBible}
                    className="rounded-xl border border-cyan-300/18 bg-cyan-300/10 px-3 py-2 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-300/16"
                  >
                    编辑项目圣经
                  </button>
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  <div className="rounded-xl border border-white/10 bg-slate-950/55 p-3">
                    <div className="mb-2 text-sm font-bold text-white">storyBible / 项目圣经</div>
                    <pre className="max-h-56 overflow-auto whitespace-pre-wrap text-xs leading-5 text-slate-400">
                      {formatJson(project.storyBible || {})}
                    </pre>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-slate-950/55 p-3">
                    <div className="mb-2 text-sm font-bold text-white">qualityCheck / 质量自检</div>
                    <pre className="max-h-56 overflow-auto whitespace-pre-wrap text-xs leading-5 text-slate-400">
                      {formatJson(selectedVersion.qualityCheck || {})}
                    </pre>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 xl:grid-cols-3">
                  <div className="rounded-xl border border-white/10 bg-slate-950/55 p-3">
                    <div className="mb-3 text-sm font-bold text-white">characterProfiles / 角色档案</div>
                    <div className="space-y-2">
                      {(project.characterProfiles || []).map((character) => (
                        <div key={character.id} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-semibold text-white">{character.name}</div>
                              <div className="mt-1 text-xs text-slate-500">{character.role || "角色"} · {character.locked ? "已锁定" : "未锁定"}</div>
                            </div>
                            <button
                              type="button"
                              onClick={() => editCharacter(character)}
                              className="rounded-lg border border-white/10 px-2 py-1 text-xs text-slate-200 hover:bg-white/[0.08]"
                            >
                              编辑
                            </button>
                          </div>
                          <p className="mt-2 text-xs leading-5 text-slate-400">
                            {character.visualLock || character.appearance || character.personality || "-"}
                          </p>
                        </div>
                      ))}
                      {!(project.characterProfiles || []).length && <div className="text-xs text-slate-500">暂无角色记忆</div>}
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-slate-950/55 p-3">
                    <div className="mb-3 text-sm font-bold text-white">storyLoops / 伏笔列表</div>
                    <div className="space-y-2">
                      {(project.storyLoops || []).map((loop) => (
                        <div key={loop.id} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-semibold text-white">{loop.title}</div>
                              <div className="mt-1 text-xs text-slate-500">{loop.status} · {loop.importance.toFixed(2)}</div>
                            </div>
                            {loop.status !== "RESOLVED" && (
                              <button
                                type="button"
                                onClick={() => resolveStoryLoop(loop)}
                                className="rounded-lg border border-white/10 px-2 py-1 text-xs text-slate-200 hover:bg-white/[0.08]"
                              >
                                标记解决
                              </button>
                            )}
                          </div>
                          <p className="mt-2 text-xs leading-5 text-slate-400">{loop.description || "-"}</p>
                        </div>
                      ))}
                      {!(project.storyLoops || []).length && <div className="text-xs text-slate-500">暂无伏笔记忆</div>}
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-slate-950/55 p-3">
                    <div className="mb-3 text-sm font-bold text-white">memoryItems / 检索记忆库</div>
                    <div className="max-h-96 space-y-2 overflow-auto pr-1">
                      {(project.memoryItems || []).map((memory) => (
                        <div key={memory.id} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-semibold text-white">{memory.title || memory.type}</div>
                              <div className="mt-1 text-xs text-slate-500">
                                {memory.type} · I {memory.importance.toFixed(2)} · R {memory.recency.toFixed(2)}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => disableMemory(memory)}
                              className="rounded-lg border border-white/10 px-2 py-1 text-xs text-slate-200 hover:bg-white/[0.08]"
                            >
                              停用
                            </button>
                          </div>
                          <p className="mt-2 text-xs leading-5 text-slate-400">{memory.content}</p>
                        </div>
                      ))}
                      {!(project.memoryItems || []).length && <div className="text-xs text-slate-500">暂无检索记忆</div>}
                    </div>
                  </div>
                </div>
              </div>

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
