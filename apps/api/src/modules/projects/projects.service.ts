import { BadRequestException, Injectable } from "@nestjs/common";
import type { Prisma, Project } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { CreateProjectDto, SaveStoryboardImageDto } from "./projects.dto";

type JsonRecord = Record<string, unknown>;

const DEFAULT_PROMPT_PREFERENCES: JsonRecord = {
  language: "zh-CN",
  aspectRatio: "16:9",
  frameRate: "24fps",
  output: ["video_prompt", "storyboard", "docx"],
};

function cleanText(value: unknown, maxLength = 500) {
  if (typeof value !== "string") return undefined;
  const text = value.replace(/\s+/g, " ").trim();
  return text ? text.slice(0, maxLength) : undefined;
}

function compactText(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .replace(/[\s#，。、：“”‘’：:,.!?！？\-_/]+/g, "");
}

function uniqueStrings(values: Array<unknown>, limit = 12) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const text = cleanText(value, 80);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    result.push(text);
    if (result.length >= limit) break;
  }
  return result;
}

function toJson(value: JsonRecord | undefined): Prisma.InputJsonValue | undefined {
  if (!value) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function pickRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function deriveEpisodeMemory(input: CreateProjectDto) {
  const shots = input.shots || [];
  const lastShot = shots.length ? shots[shots.length - 1] : undefined;
  const emotions = uniqueStrings(shots.flatMap((shot) => [shot.emotion]));
  const scenes = uniqueStrings(shots.flatMap((shot) => [shot.scene]));
  const visualFocus = uniqueStrings(shots.flatMap((shot) => [shot.visual]), 8);
  const cameraMovements = uniqueStrings(shots.flatMap((shot) => [shot.cameraMovement]));
  const transitions = uniqueStrings(shots.flatMap((shot) => [shot.transition]));
  const negativePrompts = uniqueStrings(shots.flatMap((shot) => [shot.negativePrompt]), 8);

  const episodeSummary =
    cleanText(input.episodeSummary, 700) ||
    cleanText(input.optimizedScript, 700) ||
    cleanText(input.originalScript, 700) ||
    "";
  const endingState =
    cleanText(input.endingState, 300) ||
    cleanText(lastShot?.visual || lastShot?.scene || lastShot?.videoPrompt, 300) ||
    "";
  const characterState =
    cleanText(input.characterState, 240) ||
    (emotions.length ? emotions.join("、").slice(0, 240) : "");

  const memoryJson = pickRecord(input.memoryJson);
  return {
    episodeSummary,
    endingState,
    characterState,
    memoryJson: {
      title: input.title,
      contentType: input.contentType,
      style: input.style,
      duration: input.duration,
      emotions,
      scenes,
      visualFocus,
      cameraMovements,
      transitions,
      negativePrompts,
      shots: shots.map((shot) => ({
        shotNumber: shot.shotNumber,
        scene: cleanText(shot.scene, 120),
        visual: cleanText(shot.visual, 160),
        shotType: cleanText(shot.shotType, 60),
        cameraMovement: cleanText(shot.cameraMovement, 80),
        emotion: cleanText(shot.emotion, 80),
        transition: cleanText(shot.transition, 80),
      })),
      ...memoryJson,
    } satisfies JsonRecord,
  };
}

function appendUnique(existing: unknown, additions: unknown[], limit = 30) {
  return uniqueStrings([...(Array.isArray(existing) ? existing : []), ...additions], limit);
}

function mergeStoryBible(existingValue: unknown, input: CreateProjectDto, memory: ReturnType<typeof deriveEpisodeMemory>) {
  const existing = pickRecord(existingValue);
  const inputBible = pickRecord(input.storyBible);
  const memoryJson = pickRecord(memory.memoryJson);

  return {
    ...existing,
    ...inputBible,
    genre: input.contentType || inputBible.genre || existing.genre,
    visualStyle: input.style || inputBible.visualStyle || existing.visualStyle,
    defaultDuration: input.duration || existing.defaultDuration,
    currentState: memory.endingState || existing.currentState,
    characterState: memory.characterState || existing.characterState,
    keyEvents: appendUnique(existing.keyEvents, [memory.episodeSummary], 40),
    unresolvedClues: appendUnique(existing.unresolvedClues, [
      ...(Array.isArray(memoryJson.visualFocus) ? memoryJson.visualFocus : []),
      ...(Array.isArray(memoryJson.scenes) ? memoryJson.scenes : []),
    ], 40),
    emotions: appendUnique(existing.emotions, Array.isArray(memoryJson.emotions) ? memoryJson.emotions : [], 30),
    cameraStyle: appendUnique(existing.cameraStyle, Array.isArray(memoryJson.cameraMovements) ? memoryJson.cameraMovements : [], 30),
    transitions: appendUnique(existing.transitions, Array.isArray(memoryJson.transitions) ? memoryJson.transitions : [], 30),
    forbidden: appendUnique(existing.forbidden, Array.isArray(memoryJson.negativePrompts) ? memoryJson.negativePrompts : [], 30),
  } satisfies JsonRecord;
}

function buildContextSummary(storyBible: JsonRecord, memory: ReturnType<typeof deriveEpisodeMemory>) {
  return [
    cleanText(storyBible.genre, 80),
    cleanText(storyBible.visualStyle, 120),
    cleanText(memory.endingState, 180),
  ]
    .filter(Boolean)
    .join(" · ");
}

function scoreEpisodeMemory(version: {
  versionNumber: number;
  title: string;
  originalScript: string;
  episodeSummary: string | null;
  endingState: string | null;
  characterState: string | null;
  memoryJson: Prisma.JsonValue | null;
}, currentScript: string) {
  const script = compactText(currentScript);
  const memory = pickRecord(version.memoryJson);
  const haystack = compactText([
    version.title,
    version.originalScript,
    version.episodeSummary,
    version.endingState,
    version.characterState,
    JSON.stringify(memory),
  ].join(" "));
  if (!script || !haystack) return 0;

  const tokens = Array.from(new Set(script.match(/[\u4e00-\u9fa5]{2,}|[a-z0-9]{3,}/gi) || []));
  let score = 0;
  for (const token of tokens) {
    if (haystack.includes(compactText(token))) score += 1;
  }
  return score;
}

function stringifyContextBlock(title: string, lines: string[]) {
  const body = lines.filter(Boolean).join("\n");
  return body ? `【${title}】\n${body}` : "";
}

function buildDirectorContextText(input: {
  userPreferences: JsonRecord;
  storyBible: JsonRecord;
  contextSummary: string | null;
  recentEpisodes: Array<Record<string, unknown>>;
  relatedEpisodes: Array<Record<string, unknown>>;
}) {
  const preferenceLines = Object.entries(input.userPreferences).map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join("、") : String(value)}`);
  const storyLines = Object.entries(input.storyBible)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join("、") : String(value)}`);
  const recentLines = input.recentEpisodes.map((episode) => [
    `第 ${episode.versionNumber} 集：${episode.episodeSummary || episode.title || ""}`,
    episode.endingState ? `结尾状态：${episode.endingState}` : "",
    episode.characterState ? `人物状态：${episode.characterState}` : "",
  ].filter(Boolean).join("\n"));
  const relatedLines = input.relatedEpisodes.map((episode) => [
    `第 ${episode.versionNumber} 集：${episode.episodeSummary || episode.title || ""}`,
    episode.endingState ? `相关承接：${episode.endingState}` : "",
  ].filter(Boolean).join("\n"));

  return [
    stringifyContextBlock("用户长期偏好", preferenceLines),
    stringifyContextBlock("项目剧集圣经", [
      input.contextSummary ? `摘要：${input.contextSummary}` : "",
      ...storyLines,
    ]),
    stringifyContextBlock("最近剧集摘要", recentLines),
    stringifyContextBlock("相关历史片段", relatedLines),
    stringifyContextBlock("上下文使用规则", [
      "这些内容只用于保持连续性、人物状态、地点道具和视觉风格一致。",
      "优先服务当前用户输入，不要机械复述历史剧情。",
      "不要把完整历史提示词重排进输出；最终视频提示词仍按当前模板生成。",
      "如果当前文案与历史冲突，保留当前文案，并用自然方式解释承接。",
    ]),
  ].filter(Boolean).join("\n\n");
}

function mapProjectSummary(project: Pick<Project, "id" | "title" | "contentType" | "style" | "duration" | "status" | "createdAt">) {
  return {
    id: project.id,
    title: project.title,
    content_type: project.contentType,
    style: project.style,
    duration: project.duration,
    status: project.status,
    created_at: project.createdAt.toISOString(),
  };
}

function mapShotDetail(shot: {
  id: string;
  shotNumber: number;
  scene: string | null;
  visual: string | null;
  shotType: string | null;
  cameraMovement: string | null;
  emotion: string | null;
  transition: string | null;
  firstFramePrompt: string | null;
  videoPrompt: string | null;
  lastFramePrompt: string | null;
  negativePrompt: string | null;
}) {
  return {
    id: shot.id,
    shotNumber: shot.shotNumber,
    scene: shot.scene,
    visual: shot.visual,
    shotType: shot.shotType,
    cameraMovement: shot.cameraMovement,
    emotion: shot.emotion,
    transition: shot.transition,
    firstFramePrompt: shot.firstFramePrompt,
    videoPrompt: shot.videoPrompt,
    lastFramePrompt: shot.lastFramePrompt,
    negativePrompt: shot.negativePrompt,
  };
}

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async listProjects(userId: string) {
    if (!userId) throw new BadRequestException("Authenticated user id is required");

    const projects = await this.prisma.project.findMany({
      where: { userId },
      select: {
        id: true,
        title: true,
        contentType: true,
        style: true,
        duration: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return projects.map(mapProjectSummary);
  }

  async getProject(userId: string, projectId: string) {
    if (!userId) throw new BadRequestException("Authenticated user id is required");

    const project = await this.prisma.project.findFirst({
      where: { id: projectId, userId },
      select: {
        id: true,
        title: true,
        originalScript: true,
        optimizedScript: true,
        contentType: true,
        style: true,
        duration: true,
        status: true,
        storyBible: true,
        contextSummary: true,
        createdAt: true,
        updatedAt: true,
        versions: {
          orderBy: { versionNumber: "desc" },
          select: {
            id: true,
            versionNumber: true,
            title: true,
            originalScript: true,
            optimizedScript: true,
            contentType: true,
            style: true,
            duration: true,
            status: true,
            storyboardImageUrl: true,
            storyboardImagePrompt: true,
            fullVideoPrompt: true,
            episodeSummary: true,
            endingState: true,
            characterState: true,
            memoryJson: true,
            contextSnapshot: true,
            createdAt: true,
            shots: {
              orderBy: { shotNumber: "asc" },
              select: {
                id: true,
                shotNumber: true,
                scene: true,
                visual: true,
                shotType: true,
                cameraMovement: true,
                emotion: true,
                transition: true,
                firstFramePrompt: true,
                videoPrompt: true,
                lastFramePrompt: true,
                negativePrompt: true,
              },
            },
          },
        },
      },
    });

    if (!project) throw new BadRequestException("Project not found");

    return {
      id: project.id,
      title: project.title,
      originalScript: project.originalScript,
      optimizedScript: project.optimizedScript,
      contentType: project.contentType,
      style: project.style,
      duration: project.duration,
      status: project.status,
      storyBible: project.storyBible,
      contextSummary: project.contextSummary,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
      versions: project.versions.map((version) => ({
        id: version.id,
        versionNumber: version.versionNumber,
        title: version.title,
        originalScript: version.originalScript,
        optimizedScript: version.optimizedScript,
        contentType: version.contentType,
        style: version.style,
        duration: version.duration,
        status: version.status,
        storyboardImageUrl: version.storyboardImageUrl,
        storyboardImagePrompt: version.storyboardImagePrompt,
        fullVideoPrompt: version.fullVideoPrompt,
        episodeSummary: version.episodeSummary,
        endingState: version.endingState,
        characterState: version.characterState,
        memoryJson: version.memoryJson,
        contextSnapshot: version.contextSnapshot,
        createdAt: version.createdAt.toISOString(),
        shots: version.shots.map(mapShotDetail),
      })),
    };
  }

  async deleteProject(userId: string, projectId: string) {
    if (!userId) throw new BadRequestException("Authenticated user id is required");

    const result = await this.prisma.project.deleteMany({
      where: { id: projectId, userId },
    });

    if (result.count === 0) throw new BadRequestException("Project not found");

    return { deleted: true, projectId };
  }

  async deleteProjectVersion(userId: string, projectId: string, versionId: string) {
    if (!userId) throw new BadRequestException("Authenticated user id is required");

    const result = await this.prisma.$transaction(async (prisma) => {
      const version = await prisma.projectVersion.findFirst({
        where: { id: versionId, projectId, project: { userId } },
        select: { id: true, versionNumber: true },
      });

      if (!version) throw new BadRequestException("Project version not found");

      await prisma.projectVersion.delete({ where: { id: version.id } });
      const laterVersions = await prisma.projectVersion.findMany({
        where: { projectId, versionNumber: { gt: version.versionNumber } },
        orderBy: { versionNumber: "asc" },
        select: { id: true },
      });

      for (const laterVersion of laterVersions) {
        await prisma.projectVersion.update({
          where: { id: laterVersion.id },
          data: { versionNumber: { decrement: 1 } },
        });
      }

      return { versionNumber: version.versionNumber };
    });

    return { deleted: true, projectId, versionId, versionNumber: result.versionNumber };
  }

  async buildGenerationContext(userId: string, projectId: string, currentScript: string) {
    if (!userId) throw new BadRequestException("Authenticated user id is required");

    const project = await this.prisma.project.findFirst({
      where: { id: projectId, userId },
      select: {
        id: true,
        title: true,
        storyBible: true,
        contextSummary: true,
        user: {
          select: {
            promptPreferences: true,
          },
        },
        versions: {
          orderBy: { versionNumber: "desc" },
          select: {
            id: true,
            versionNumber: true,
            title: true,
            originalScript: true,
            episodeSummary: true,
            endingState: true,
            characterState: true,
            memoryJson: true,
            createdAt: true,
          },
        },
      },
    });

    if (!project) throw new BadRequestException("Project not found");

    const recentEpisodes = project.versions.slice(0, 3).map((version) => ({
      id: version.id,
      versionNumber: version.versionNumber,
      title: version.title,
      episodeSummary: version.episodeSummary,
      endingState: version.endingState,
      characterState: version.characterState,
      memoryJson: version.memoryJson,
      createdAt: version.createdAt.toISOString(),
    }));
    const recentIds = new Set(recentEpisodes.map((episode) => episode.id));
    const relatedEpisodes = project.versions
      .filter((version) => !recentIds.has(version.id))
      .map((version) => ({ version, score: scoreEpisodeMemory(version, currentScript) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(({ version, score }) => ({
        id: version.id,
        versionNumber: version.versionNumber,
        title: version.title,
        episodeSummary: version.episodeSummary,
        endingState: version.endingState,
        characterState: version.characterState,
        memoryJson: version.memoryJson,
        relevanceScore: score,
        createdAt: version.createdAt.toISOString(),
      }));

    const userPreferences = {
      ...DEFAULT_PROMPT_PREFERENCES,
      ...pickRecord(project.user.promptPreferences),
    };
    const storyBible = pickRecord(project.storyBible);
    const contextText = buildDirectorContextText({
      userPreferences,
      storyBible,
      contextSummary: project.contextSummary,
      recentEpisodes,
      relatedEpisodes,
    });

    return {
      projectId: project.id,
      title: project.title,
      userPreferences,
      storyBible,
      contextSummary: project.contextSummary,
      recentEpisodes,
      relatedEpisodes,
      contextText,
    };
  }

  async createProject(userId: string, input: CreateProjectDto) {
    if (!userId) throw new BadRequestException("Authenticated user id is required");
    const episodeMemory = deriveEpisodeMemory(input);

    const result = await this.prisma.$transaction(async (prisma) => {
      const project = input.projectId
        ? await prisma.project.update({
            where: { id: input.projectId, userId },
            data: {
              title: input.title,
              originalScript: input.originalScript,
              optimizedScript: input.optimizedScript,
              contentType: input.contentType,
              style: input.style,
              duration: input.duration,
              status: input.status || "draft",
            },
            select: { id: true, storyBible: true },
          })
        : await prisma.project.create({
            data: {
              userId,
              title: input.title,
              originalScript: input.originalScript,
              optimizedScript: input.optimizedScript,
              contentType: input.contentType,
              style: input.style,
              duration: input.duration,
              status: input.status || "draft",
            },
            select: { id: true, storyBible: true },
          });
      const storyBible = mergeStoryBible(project.storyBible, input, episodeMemory);
      const contextSummary = cleanText(input.contextSummary, 500) || buildContextSummary(storyBible, episodeMemory);
      const contextSnapshot = {
        storyBible,
        priorContext: input.contextSnapshot || null,
      };

      if (input.versionId) {
        const ownedVersion = await prisma.projectVersion.findFirst({
          where: { id: input.versionId, projectId: project.id, project: { userId } },
          select: { id: true, versionNumber: true },
        });
        if (!ownedVersion) throw new BadRequestException("Project version not found");

        await prisma.storyboardShot.deleteMany({ where: { versionId: input.versionId } });

        const version = await prisma.projectVersion.update({
          where: { id: ownedVersion.id },
          data: {
            title: input.title,
            originalScript: input.originalScript,
            optimizedScript: input.optimizedScript,
            contentType: input.contentType,
            style: input.style,
            duration: input.duration,
            status: input.status || "draft",
            storyboardImageUrl: input.storyboardImageUrl,
            storyboardImagePrompt: input.storyboardImagePrompt,
            fullVideoPrompt: input.fullVideoPrompt,
            episodeSummary: episodeMemory.episodeSummary,
            endingState: episodeMemory.endingState,
            characterState: episodeMemory.characterState,
            memoryJson: toJson(episodeMemory.memoryJson),
            contextSnapshot: toJson(contextSnapshot),
            shots: {
              create: input.shots.map((shot) => ({
                projectId: project.id,
                shotNumber: shot.shotNumber,
                scene: shot.scene,
                visual: shot.visual,
                shotType: shot.shotType,
                cameraMovement: shot.cameraMovement,
                emotion: shot.emotion,
                transition: shot.transition,
                firstFramePrompt: shot.firstFramePrompt,
                videoPrompt: shot.videoPrompt,
                lastFramePrompt: shot.lastFramePrompt,
                negativePrompt: shot.negativePrompt,
              })),
            },
          },
          select: { id: true },
        });

        await prisma.project.update({
          where: { id: project.id },
          data: {
            storyBible: toJson(storyBible),
            contextSummary,
          },
        });

        return { project, version, versionNumber: ownedVersion.versionNumber };
      }

      const latestVersion = await prisma.projectVersion.findFirst({
        where: { projectId: project.id },
        orderBy: { versionNumber: "desc" },
        select: { versionNumber: true },
      });
      const versionNumber = latestVersion ? latestVersion.versionNumber + 1 : 1;

      const version = await prisma.projectVersion.create({
        data: {
          projectId: project.id,
          versionNumber,
          title: input.title,
          originalScript: input.originalScript,
          optimizedScript: input.optimizedScript,
          contentType: input.contentType,
          style: input.style,
          duration: input.duration,
          status: input.status || "draft",
          storyboardImageUrl: input.storyboardImageUrl,
          storyboardImagePrompt: input.storyboardImagePrompt,
          fullVideoPrompt: input.fullVideoPrompt,
          episodeSummary: episodeMemory.episodeSummary,
          endingState: episodeMemory.endingState,
          characterState: episodeMemory.characterState,
          memoryJson: toJson(episodeMemory.memoryJson),
          contextSnapshot: toJson(contextSnapshot),
          shots: {
            create: input.shots.map((shot) => ({
              projectId: project.id,
              shotNumber: shot.shotNumber,
              scene: shot.scene,
              visual: shot.visual,
              shotType: shot.shotType,
              cameraMovement: shot.cameraMovement,
              emotion: shot.emotion,
              transition: shot.transition,
              firstFramePrompt: shot.firstFramePrompt,
              videoPrompt: shot.videoPrompt,
              lastFramePrompt: shot.lastFramePrompt,
              negativePrompt: shot.negativePrompt,
            })),
          },
        },
        select: { id: true },
      });

      await prisma.project.update({
        where: { id: project.id },
        data: {
          storyBible: toJson(storyBible),
          contextSummary,
        },
      });

      return { project, version, versionNumber };
    });

    return { saved: true, projectId: result.project.id, versionId: result.version.id, versionNumber: result.versionNumber };
  }

  async saveStoryboardImage(userId: string, projectId: string, versionId: string, input: SaveStoryboardImageDto) {
    if (!userId) throw new BadRequestException("Authenticated user id is required");

    const ownedVersion = await this.prisma.projectVersion.findFirst({
      where: {
        id: versionId,
        projectId,
        project: { userId },
      },
      select: { id: true },
    });
    if (!ownedVersion) throw new BadRequestException("Project version not found");

    const version = await this.prisma.projectVersion.update({
      where: { id: ownedVersion.id },
      data: {
        storyboardImageUrl: input.storyboardImageUrl,
        storyboardImagePrompt: input.storyboardImagePrompt,
      },
      select: {
        id: true,
        projectId: true,
        versionNumber: true,
        storyboardImageUrl: true,
      },
    });

    return {
      saved: true,
      projectId: version.projectId,
      versionId: version.id,
      versionNumber: version.versionNumber,
      storyboardImageUrl: version.storyboardImageUrl,
    };
  }
}
