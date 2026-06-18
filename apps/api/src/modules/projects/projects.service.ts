import { BadRequestException, Injectable } from "@nestjs/common";
import type { Project } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { CreateProjectDto, SaveStoryboardImageDto } from "./projects.dto";

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
        createdAt: version.createdAt.toISOString(),
        shots: version.shots.map(mapShotDetail),
      })),
    };
  }

  async createProject(userId: string, input: CreateProjectDto) {
    if (!userId) throw new BadRequestException("Authenticated user id is required");

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
            select: { id: true },
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
            select: { id: true },
          });

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
