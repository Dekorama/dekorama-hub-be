import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import { Request } from "express";
import { ProjectsService } from "./projects.service";
import {
  AddProjectDepartmentsDto,
  AddProjectProductDto,
  AssignProjectMemberDto,
  CreateProgressEntryDto,
  CreateProjectDto,
  CreateProjectNoteDto,
  EnrichDepartmentDto,
  InviteProjectMemberDto,
  UpdateDepartmentProgressDto,
  UpdateProjectDto,
} from "./project.dto";
import { AuthService } from "../auth/auth.service";
import { UserRole } from "../users/user.entity";

@Controller("projects")
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly authService: AuthService,
  ) {}

  private async requireUser(req: Request) {
    const userId = (req as Request & { cookies?: Record<string, string> }).cookies?.[
      "dekorama_session"
    ];
    if (!userId) throw new UnauthorizedException();
    const user = await this.authService.findById(userId);
    if (!user) throw new UnauthorizedException();
    return user;
  }

  @Get()
  async list(@Req() req: Request) {
    const userId = (req as Request & { cookies?: Record<string, string> }).cookies?.[
      "dekorama_session"
    ];
    if (!userId) return this.projectsService.listPublic();
    const user = await this.authService.findById(userId);
    if (!user) return this.projectsService.listPublic();
    if (user.role === "client") {
      return this.projectsService.listAccessible(user);
    }
    if (user.role === "professional") {
      return this.projectsService.listPublic(user.country);
    }
    if (user.role === UserRole.ADMIN) {
      return this.projectsService.listForAdmin();
    }
    return this.projectsService.listPublic();
  }

  @Get(":id")
  async findOne(@Param("id") id: string, @Req() req: Request) {
    const user = await this.requireUser(req);
    return this.projectsService.findOne(id, user);
  }

  @Post()
  async create(@Body() body: CreateProjectDto, @Req() req: Request) {
    const user = await this.requireUser(req);
    return this.projectsService.create(body, user);
  }

  @Patch(":id")
  async update(
    @Param("id") id: string,
    @Body() body: UpdateProjectDto,
    @Req() req: Request,
  ) {
    const user = await this.requireUser(req);
    return this.projectsService.update(id, body, user);
  }

  @Post(":id/departments")
  async addDepartments(
    @Param("id") projectId: string,
    @Body() body: AddProjectDepartmentsDto,
    @Req() req: Request,
  ) {
    const user = await this.requireUser(req);
    return this.projectsService.addDepartments(projectId, body, user);
  }

  @Patch(":id/departments/:deptId")
  async enrichDepartment(
    @Param("id") projectId: string,
    @Param("deptId") departmentId: string,
    @Body() body: EnrichDepartmentDto,
    @Req() req: Request,
  ) {
    const user = await this.requireUser(req);
    return this.projectsService.enrichDepartment(projectId, departmentId, body, user);
  }

  @Patch(":id/departments/:deptId/progress")
  async updateDepartmentProgress(
    @Param("id") projectId: string,
    @Param("deptId") departmentId: string,
    @Body() body: UpdateDepartmentProgressDto,
    @Req() req: Request,
  ) {
    const user = await this.requireUser(req);
    return this.projectsService.updateDepartmentProgress(
      projectId,
      departmentId,
      body,
      user,
    );
  }

  @Patch(":id/publish")
  async publish(@Param("id") id: string, @Req() req: Request) {
    const user = await this.requireUser(req);
    return this.projectsService.publish(id, user);
  }

  @Get(":id/progress")
  async listProgress(@Param("id") id: string, @Req() req: Request) {
    const user = await this.requireUser(req);
    return this.projectsService.listProgress(id, user);
  }

  @Post(":id/progress")
  async addProgress(
    @Param("id") id: string,
    @Body() body: CreateProgressEntryDto,
    @Req() req: Request,
  ) {
    const user = await this.requireUser(req);
    return this.projectsService.addProgress(id, body, user);
  }

  @Get(":id/notes")
  async listNotes(@Param("id") id: string, @Req() req: Request) {
    const user = await this.requireUser(req);
    return this.projectsService.listNotes(id, user);
  }

  @Post(":id/notes")
  async addNote(
    @Param("id") id: string,
    @Body() body: CreateProjectNoteDto,
    @Req() req: Request,
  ) {
    const user = await this.requireUser(req);
    return this.projectsService.addNote(id, body, user);
  }

  @Get(":id/products")
  async listProducts(@Param("id") id: string, @Req() req: Request) {
    const user = await this.requireUser(req);
    return this.projectsService.listProducts(id, user);
  }

  @Post(":id/products")
  async addProduct(
    @Param("id") id: string,
    @Body() body: AddProjectProductDto,
    @Req() req: Request,
  ) {
    const user = await this.requireUser(req);
    return this.projectsService.addProduct(id, body, user);
  }

  @Delete(":id/products/:productId")
  async removeProduct(
    @Param("id") id: string,
    @Param("productId") productId: string,
    @Req() req: Request,
  ) {
    const user = await this.requireUser(req);
    await this.projectsService.removeProduct(id, productId, user);
    return { ok: true };
  }

  @Get(":id/members")
  async listMembers(@Param("id") id: string, @Req() req: Request) {
    const user = await this.requireUser(req);
    return this.projectsService.listMembers(id, user);
  }

  @Post(":id/members")
  async assignMember(
    @Param("id") id: string,
    @Body() body: AssignProjectMemberDto,
    @Req() req: Request,
  ) {
    const user = await this.requireUser(req);
    return this.projectsService.assignMember(id, body, user);
  }

  @Post(":id/invite")
  async inviteMember(
    @Param("id") id: string,
    @Body() body: InviteProjectMemberDto,
    @Req() req: Request,
  ) {
    const user = await this.requireUser(req);
    return this.projectsService.inviteMember(id, body, user);
  }

  @Delete(":id/members/:userId")
  async removeMember(
    @Param("id") id: string,
    @Param("userId") memberUserId: string,
    @Req() req: Request,
  ) {
    const user = await this.requireUser(req);
    await this.projectsService.removeMember(id, memberUserId, user);
    return { ok: true };
  }

  @Delete(":id")
  async remove(@Param("id") id: string, @Req() req: Request) {
    const user = await this.requireUser(req);
    await this.projectsService.remove(id, user);
    return { ok: true };
  }
}
