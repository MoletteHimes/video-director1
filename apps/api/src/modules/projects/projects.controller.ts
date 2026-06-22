import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { ok } from "../../common/api-response";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { BuildProjectContextDto, CreateProjectDto, SaveStoryboardImageDto } from "./projects.dto";
import { ProjectsService } from "./projects.service";

@Controller("projects")
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  async listProjects(@Req() request: { user: { id: string } }) {
    const projects = await this.projectsService.listProjects(request.user.id);
    return ok({ projects });
  }

  @Get(":projectId")
  async getProject(@Req() request: { user: { id: string } }, @Param("projectId") projectId: string) {
    const project = await this.projectsService.getProject(request.user.id, projectId);
    return ok({ project });
  }

  @Delete(":projectId")
  async deleteProject(@Req() request: { user: { id: string } }, @Param("projectId") projectId: string) {
    const result = await this.projectsService.deleteProject(request.user.id, projectId);
    return ok(result);
  }

  @Delete(":projectId/versions/:versionId")
  async deleteProjectVersion(
    @Req() request: { user: { id: string } },
    @Param("projectId") projectId: string,
    @Param("versionId") versionId: string,
  ) {
    const result = await this.projectsService.deleteProjectVersion(request.user.id, projectId, versionId);
    return ok(result);
  }

  @Post(":projectId/context")
  async buildProjectContext(
    @Req() request: { user: { id: string } },
    @Param("projectId") projectId: string,
    @Body() body: BuildProjectContextDto,
  ) {
    const result = await this.projectsService.buildGenerationContext(request.user.id, projectId, body.currentScript);
    return ok(result);
  }

  @Post()
  async createProject(@Req() request: { user: { id: string } }, @Body() body: CreateProjectDto) {
    const result = await this.projectsService.createProject(request.user.id, body);
    return ok(result);
  }

  @Post(":projectId/versions/:versionId/storyboard-image")
  async saveStoryboardImage(
    @Req() request: { user: { id: string } },
    @Param("projectId") projectId: string,
    @Param("versionId") versionId: string,
    @Body() body: SaveStoryboardImageDto,
  ) {
    const result = await this.projectsService.saveStoryboardImage(request.user.id, projectId, versionId, body);
    return ok(result);
  }
}
