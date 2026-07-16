import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import * as crypto from "crypto";
import { Project, ProjectStatus, ProjectType } from "./project.entity";
import { ProjectDepartment } from "./entities/project-department.entity";
import { ProjectProgressEntry } from "./entities/project-progress-entry.entity";
import { ProjectNote } from "./entities/project-note.entity";
import { ProjectProduct } from "./entities/project-product.entity";
import {
  ProjectMember,
  ProjectMemberRole,
} from "./entities/project-member.entity";
import {
  ProjectInvitation,
  ProjectInvitationStatus,
} from "./entities/project-invitation.entity";
import { AccountType, User, UserRole } from "../users/user.entity";
import { MarketCode } from "../common/market";
import { Product } from "../products/product.entity";
import {
  AddProjectProductDto,
  AssignProjectMemberDto,
  CreateProgressEntryDto,
  AddProjectDepartmentsDto,
  CreateProjectDto,
  CreateProjectNoteDto,
  EnrichDepartmentDto,
  InviteProjectMemberDto,
  UpdateDepartmentProgressDto,
  UpdateProjectDto,
} from "./project.dto";
import { EmailService } from "../email/email.service";

const ROLE_RANK: Record<ProjectMemberRole, number> = {
  [ProjectMemberRole.OWNER]: 3,
  [ProjectMemberRole.EDITOR]: 2,
  [ProjectMemberRole.VIEWER]: 1,
};

@Injectable()
export class ProjectsService {
  private readonly TOKEN_SECRET =
    process.env.INVITATION_TOKEN_SECRET ||
    "dekorama-invitations-secret-change-in-production";
  private readonly FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

  constructor(
    @InjectRepository(Project)
    private readonly repo: Repository<Project>,
    @InjectRepository(ProjectDepartment)
    private readonly deptRepo: Repository<ProjectDepartment>,
    @InjectRepository(ProjectProgressEntry)
    private readonly progressRepo: Repository<ProjectProgressEntry>,
    @InjectRepository(ProjectNote)
    private readonly noteRepo: Repository<ProjectNote>,
    @InjectRepository(ProjectProduct)
    private readonly productRepo: Repository<ProjectProduct>,
    @InjectRepository(ProjectMember)
    private readonly memberRepo: Repository<ProjectMember>,
    @InjectRepository(ProjectInvitation)
    private readonly invitationRepo: Repository<ProjectInvitation>,
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    @InjectRepository(Product)
    private readonly catalogRepo: Repository<Product>,
    private readonly emailService: EmailService,
  ) {}

  listPublic(country?: MarketCode): Promise<Project[]> {
    const qb = this.repo
      .createQueryBuilder("project")
      .leftJoinAndSelect("project.client", "client")
      .leftJoinAndSelect("project.departments", "departments")
      .where("project.isPublic = :isPublic", { isPublic: true })
      .orderBy("project.createdAt", "DESC");

    if (country) {
      qb.andWhere("client.country = :country", { country });
    }

    return qb.getMany();
  }

  async listForAdmin(filters?: {
    country?: MarketCode;
    status?: ProjectStatus;
    projectType?: ProjectType;
    isPublic?: boolean;
    search?: string;
  }): Promise<Project[]> {
    const qb = this.repo
      .createQueryBuilder("project")
      .leftJoinAndSelect("project.client", "client")
      .leftJoinAndSelect("project.departments", "departments")
      .orderBy("project.createdAt", "DESC");

    if (filters?.country) {
      qb.andWhere("client.country = :country", { country: filters.country });
    }
    if (filters?.status) {
      qb.andWhere("project.status = :status", { status: filters.status });
    }
    if (filters?.projectType) {
      qb.andWhere("project.projectType = :projectType", {
        projectType: filters.projectType,
      });
    }
    if (filters?.isPublic !== undefined) {
      qb.andWhere("project.isPublic = :isPublic", { isPublic: filters.isPublic });
    }
    if (filters?.search?.trim()) {
      qb.andWhere(
        "(project.title ILIKE :search OR project.description ILIKE :search OR client.name ILIKE :search OR client.email ILIKE :search OR project.locality ILIKE :search)",
        { search: `%${filters.search.trim()}%` },
      );
    }

    return qb.getMany();
  }

  async listAccessible(user: User): Promise<Project[]> {
    if (user.role === UserRole.ADMIN) {
      return this.repo.find({ relations: ["departments"], order: { createdAt: "DESC" } });
    }

    const owned = await this.repo.find({
      where: { clientId: user.id },
      relations: ["departments"],
      order: { createdAt: "DESC" },
    });

    const memberships = await this.memberRepo.find({
      where: { userId: user.id },
      relations: ["project", "project.departments"],
    });
    const memberProjects = memberships.map((m) => m.project);

    let communityProjects: Project[] = [];
    if (user.accountType === AccountType.COMMUNITY) {
      const members = await this.usersRepo.find({
        where: { parentAccountId: user.id },
      });
      const memberIds = members.map((m) => m.id);
      if (memberIds.length > 0) {
        communityProjects = await this.repo.find({
          where: { clientId: In(memberIds) },
          relations: ["departments"],
          order: { createdAt: "DESC" },
        });
      }
    }

    const merged = new Map<string, Project>();
    for (const p of [...owned, ...memberProjects, ...communityProjects]) {
      merged.set(p.id, p);
    }
    return Array.from(merged.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
  }

  async getMemberRole(projectId: string, userId: string): Promise<ProjectMemberRole | null> {
    const project = await this.repo.findOneBy({ id: projectId });
    if (!project) return null;
    if (project.clientId === userId) return ProjectMemberRole.OWNER;

    const member = await this.memberRepo.findOne({ where: { projectId, userId } });
    return member?.role ?? null;
  }

  async canViewProject(user: User, project: Project): Promise<boolean> {
    if (user.role === UserRole.ADMIN) return true;
    if (project.clientId === user.id) return true;

    const member = await this.memberRepo.findOne({
      where: { projectId: project.id, userId: user.id },
    });
    if (member) return true;

    if (user.accountType === AccountType.COMMUNITY) {
      const owner = await this.usersRepo.findOneBy({ id: project.clientId });
      if (owner?.parentAccountId === user.id) return true;
    }

    if (project.isPublic) {
      if (user.role === UserRole.PROFESSIONAL) {
        const client = await this.usersRepo.findOneBy({ id: project.clientId });
        const projectCountry = client?.country ?? project.country;
        return projectCountry === user.country;
      }
      return true;
    }

    return false;
  }

  async canEditProject(user: User, project: Project): Promise<boolean> {
    if (user.role === UserRole.ADMIN) return true;
    if (project.clientId === user.id) return true;

    const member = await this.memberRepo.findOne({
      where: { projectId: project.id, userId: user.id },
    });
    if (member && ROLE_RANK[member.role] >= ROLE_RANK[ProjectMemberRole.EDITOR]) {
      return true;
    }

    if (user.accountType === AccountType.COMMUNITY) {
      const owner = await this.usersRepo.findOneBy({ id: project.clientId });
      if (owner?.parentAccountId === user.id) return true;
    }

    return false;
  }

  async canManageMembers(user: User, project: Project): Promise<boolean> {
    if (user.role === UserRole.ADMIN) return true;
    if (project.clientId === user.id) return true;
    if (user.accountType === AccountType.COMMUNITY) {
      const owner = await this.usersRepo.findOneBy({ id: project.clientId });
      if (owner?.parentAccountId === user.id) return true;
    }
    return false;
  }

  async findOne(id: string, requestingUser: User): Promise<Project> {
    const project = await this.repo.findOne({
      where: { id },
      relations: ["departments"],
    });
    if (!project) throw new NotFoundException("Proyecto no encontrado");

    const canView = await this.canViewProject(requestingUser, project);
    if (!canView) throw new ForbiddenException("Sin acceso al proyecto");

    return project;
  }

  async create(dto: CreateProjectDto, client: User): Promise<Project> {
    if (client.role !== UserRole.CLIENT) {
      throw new ForbiddenException("Solo clientes pueden crear proyectos");
    }

    const { departments, country: _country, ...projectData } = dto;
    const project = this.repo.create({
      ...projectData,
      country: client.country,
      clientId: client.id,
      isDetailed: false,
    });
    const savedProject = await this.repo.save(project);

    if (departments?.length) {
      const deptRecords = departments.map((dept) =>
        this.deptRepo.create({ projectId: savedProject.id, department: dept }),
      );
      await this.deptRepo.save(deptRecords);
    }

    await this.memberRepo.save(
      this.memberRepo.create({
        projectId: savedProject.id,
        userId: client.id,
        role: ProjectMemberRole.OWNER,
      }),
    );

    return this.repo.findOne({
      where: { id: savedProject.id },
      relations: ["departments"],
    }) as Promise<Project>;
  }

  async addDepartments(
    projectId: string,
    dto: AddProjectDepartmentsDto,
    requestingUser: User,
  ): Promise<Project> {
    const project = await this.repo.findOne({
      where: { id: projectId },
      relations: ["departments"],
    });
    if (!project) throw new NotFoundException("Proyecto no encontrado");
    if (!(await this.canEditProject(requestingUser, project))) {
      throw new ForbiddenException("Sin permiso para configurar departamentos");
    }
    if (!dto.departments?.length) {
      throw new BadRequestException("Selecciona al menos un departamento");
    }

    const existingTypes = new Set(project.departments.map((d) => d.department));
    const toAdd = dto.departments.filter((dept) => !existingTypes.has(dept));
    if (toAdd.length === 0) {
      throw new BadRequestException("Los departamentos seleccionados ya existen");
    }

    const records = toAdd.map((dept) =>
      this.deptRepo.create({ projectId, department: dept }),
    );
    await this.deptRepo.save(records);

    return this.repo.findOne({
      where: { id: projectId },
      relations: ["departments"],
    }) as Promise<Project>;
  }

  async enrichDepartment(
    projectId: string,
    departmentId: string,
    dto: EnrichDepartmentDto,
    requestingUser: User,
  ): Promise<ProjectDepartment> {
    const project = await this.repo.findOne({ where: { id: projectId } });
    if (!project) throw new NotFoundException("Proyecto no encontrado");
    if (!(await this.canEditProject(requestingUser, project))) {
      throw new ForbiddenException("Sin permiso para editar departamentos");
    }

    const department = await this.deptRepo.findOne({
      where: { id: departmentId, projectId },
    });
    if (!department) throw new NotFoundException("Departamento no encontrado");

    Object.assign(department, dto);
    return this.deptRepo.save(department);
  }

  async updateDepartmentProgress(
    projectId: string,
    departmentId: string,
    dto: UpdateDepartmentProgressDto,
    requestingUser: User,
  ): Promise<ProjectDepartment> {
    const project = await this.repo.findOne({ where: { id: projectId } });
    if (!project) throw new NotFoundException("Proyecto no encontrado");
    if (!(await this.canEditProject(requestingUser, project))) {
      throw new ForbiddenException("Sin permiso para actualizar progreso");
    }

    const department = await this.deptRepo.findOne({
      where: { id: departmentId, projectId },
    });
    if (!department) throw new NotFoundException("Departamento no encontrado");

    if (dto.status !== undefined) department.status = dto.status;
    if (dto.progressPercentage !== undefined) {
      if (dto.progressPercentage < 0 || dto.progressPercentage > 100) {
        throw new BadRequestException("El progreso debe estar entre 0 y 100");
      }
      department.progressPercentage = dto.progressPercentage;
    }

    return this.deptRepo.save(department);
  }

  async publish(projectId: string, requestingUser: User): Promise<Project> {
    const project = await this.repo.findOne({
      where: { id: projectId },
      relations: ["departments"],
    });
    if (!project) throw new NotFoundException("Proyecto no encontrado");
    if (project.clientId !== requestingUser.id) {
      throw new ForbiddenException("Solo el dueño puede publicar");
    }

    const missingFields = this.validateDepartmentCompleteness(
      project.projectType,
      project.departments,
    );
    if (missingFields.length > 0) {
      throw new BadRequestException(`Faltan campos: ${missingFields.join(", ")}`);
    }

    project.isDetailed = true;
    project.status = ProjectStatus.OPEN;
    return this.repo.save(project);
  }

  validateDepartmentCompleteness(
    projectType: ProjectType,
    departments: ProjectDepartment[],
  ): string[] {
    const missing: string[] = [];

    for (const dept of departments) {
      if (!dept.technicalDetails) {
        missing.push(`${dept.department}: technicalDetails`);
      }
      if (projectType === ProjectType.RECONSTRUCTION && !dept.damageDescription) {
        missing.push(`${dept.department}: damageDescription`);
      }
      if (projectType === ProjectType.RENOVATION && !dept.designNotes) {
        missing.push(`${dept.department}: designNotes`);
      }
      if (
        projectType === ProjectType.NEW_BUILD &&
        (!dept.blueprints || dept.blueprints.length === 0)
      ) {
        missing.push(`${dept.department}: blueprints`);
      }
    }

    return missing;
  }

  async update(id: string, dto: UpdateProjectDto, requestingUser: User): Promise<Project> {
    const project = await this.repo.findOneBy({ id });
    if (!project) throw new NotFoundException("Proyecto no encontrado");
    if (project.clientId !== requestingUser.id && requestingUser.role !== UserRole.ADMIN) {
      throw new ForbiddenException("Solo el creador puede editar la información del proyecto");
    }
    const { country: _country, ...updates } = dto;
    Object.assign(project, updates);
    return this.repo.save(project);
  }

  async remove(id: string, requestingUser: User): Promise<void> {
    const project = await this.repo.findOneBy({ id });
    if (!project) throw new NotFoundException("Proyecto no encontrado");
    if (project.clientId !== requestingUser.id) {
      throw new ForbiddenException("Solo el dueño puede eliminar");
    }
    await this.repo.remove(project);
  }

  async listProgress(projectId: string, user: User): Promise<ProjectProgressEntry[]> {
    const project = await this.findOne(projectId, user);
    return this.progressRepo.find({
      where: { projectId: project.id },
      relations: ["department", "createdBy"],
      order: { createdAt: "DESC" },
    });
  }

  async addProgress(
    projectId: string,
    dto: CreateProgressEntryDto,
    user: User,
  ): Promise<ProjectProgressEntry> {
    const project = await this.repo.findOneBy({ id: projectId });
    if (!project) throw new NotFoundException("Proyecto no encontrado");
    if (!(await this.canEditProject(user, project))) {
      throw new ForbiddenException("Sin permiso para registrar progreso");
    }

    if (dto.departmentId) {
      const dept = await this.deptRepo.findOne({
        where: { id: dto.departmentId, projectId },
      });
      if (!dept) throw new NotFoundException("Departamento no encontrado");
    }

    const entry = this.progressRepo.create({
      projectId,
      departmentId: dto.departmentId ?? null,
      title: dto.title,
      description: dto.description,
      progressPercentage: dto.progressPercentage ?? null,
      createdById: user.id,
    });
    const saved = await this.progressRepo.save(entry);

    if (dto.departmentId && dto.progressPercentage !== undefined) {
      await this.updateDepartmentProgress(
        projectId,
        dto.departmentId,
        { progressPercentage: dto.progressPercentage },
        user,
      );
    }

    return this.progressRepo.findOne({
      where: { id: saved.id },
      relations: ["department", "createdBy"],
    }) as Promise<ProjectProgressEntry>;
  }

  async listNotes(projectId: string, user: User): Promise<ProjectNote[]> {
    const project = await this.findOne(projectId, user);
    return this.noteRepo.find({
      where: { projectId: project.id },
      relations: ["author"],
      order: { createdAt: "DESC" },
    });
  }

  async addNote(
    projectId: string,
    dto: CreateProjectNoteDto,
    user: User,
  ): Promise<ProjectNote> {
    const project = await this.repo.findOneBy({ id: projectId });
    if (!project) throw new NotFoundException("Proyecto no encontrado");
    if (!(await this.canEditProject(user, project))) {
      throw new ForbiddenException("Sin permiso para agregar notas");
    }

    const note = this.noteRepo.create({
      projectId,
      authorId: user.id,
      content: dto.content,
    });
    const saved = await this.noteRepo.save(note);
    return this.noteRepo.findOne({
      where: { id: saved.id },
      relations: ["author"],
    }) as Promise<ProjectNote>;
  }

  async listProducts(projectId: string, user: User): Promise<ProjectProduct[]> {
    const project = await this.findOne(projectId, user);
    return this.productRepo.find({
      where: { projectId: project.id },
      relations: ["addedBy"],
      order: { createdAt: "DESC" },
    });
  }

  async addProduct(
    projectId: string,
    dto: AddProjectProductDto,
    user: User,
  ): Promise<ProjectProduct> {
    const project = await this.repo.findOneBy({ id: projectId });
    if (!project) throw new NotFoundException("Proyecto no encontrado");
    if (!(await this.canEditProject(user, project))) {
      throw new ForbiddenException("Sin permiso para agregar productos");
    }

    const catalogProduct = await this.catalogRepo.findOne({
      where: { sku: dto.productSku },
    });
    if (!catalogProduct) {
      throw new NotFoundException(`Producto ${dto.productSku} no encontrado`);
    }

    const item = this.productRepo.create({
      projectId,
      productSku: dto.productSku,
      productName: catalogProduct.name,
      quantity: dto.quantity,
      notes: dto.notes ?? null,
      addedById: user.id,
    });
    const saved = await this.productRepo.save(item);
    return this.productRepo.findOne({
      where: { id: saved.id },
      relations: ["addedBy"],
    }) as Promise<ProjectProduct>;
  }

  async removeProduct(
    projectId: string,
    productId: string,
    user: User,
  ): Promise<void> {
    const project = await this.repo.findOneBy({ id: projectId });
    if (!project) throw new NotFoundException("Proyecto no encontrado");
    if (!(await this.canEditProject(user, project))) {
      throw new ForbiddenException("Sin permiso para eliminar productos");
    }

    const item = await this.productRepo.findOne({ where: { id: productId, projectId } });
    if (!item) throw new NotFoundException("Producto no encontrado en el proyecto");
    await this.productRepo.remove(item);
  }

  async listMembers(projectId: string, user: User) {
    const project = await this.findOne(projectId, user);
    const members = await this.memberRepo.find({
      where: { projectId: project.id },
      relations: ["user"],
      order: { joinedAt: "ASC" },
    });

    const invitations = await this.invitationRepo.find({
      where: { projectId: project.id, status: ProjectInvitationStatus.PENDING },
      order: { createdAt: "DESC" },
    });

    return { members, invitations };
  }

  async assignMember(
    projectId: string,
    dto: AssignProjectMemberDto,
    user: User,
  ): Promise<ProjectMember> {
    const project = await this.repo.findOneBy({ id: projectId });
    if (!project) throw new NotFoundException("Proyecto no encontrado");
    if (!(await this.canManageMembers(user, project))) {
      throw new ForbiddenException("Sin permiso para gestionar miembros");
    }

    const targetUser = await this.usersRepo.findOneBy({ id: dto.userId });
    if (!targetUser) throw new NotFoundException("Usuario no encontrado");

    if (user.accountType === AccountType.COMMUNITY) {
      const isCommunityMember =
        targetUser.parentAccountId === user.id || targetUser.id === user.id;
      if (!isCommunityMember && targetUser.id !== project.clientId) {
        throw new BadRequestException("Solo miembros de la comunidad pueden ser asignados");
      }
    }

    const existing = await this.memberRepo.findOne({
      where: { projectId, userId: dto.userId },
    });
    if (existing) {
      existing.role = dto.role === ProjectMemberRole.OWNER ? ProjectMemberRole.EDITOR : dto.role;
      return this.memberRepo.save(existing);
    }

    if (dto.role === ProjectMemberRole.OWNER && project.clientId !== dto.userId) {
      throw new BadRequestException("Solo el creador puede ser owner");
    }

    return this.memberRepo.save(
      this.memberRepo.create({
        projectId,
        userId: dto.userId,
        role: dto.role,
      }),
    );
  }

  async inviteMember(
    projectId: string,
    dto: InviteProjectMemberDto,
    user: User,
  ): Promise<ProjectInvitation> {
    const project = await this.repo.findOneBy({ id: projectId });
    if (!project) throw new NotFoundException("Proyecto no encontrado");
    if (!(await this.canManageMembers(user, project))) {
      throw new ForbiddenException("Sin permiso para invitar");
    }

    const email = dto.email.trim().toLowerCase();
    const existingUser = await this.usersRepo.findOne({ where: { email } });
    if (existingUser) {
      return this.assignMember(
        projectId,
        { userId: existingUser.id, role: dto.role },
        user,
      ) as unknown as ProjectInvitation;
    }

    const token = this.generateToken(email, projectId);
    const invitation = await this.invitationRepo.save(
      this.invitationRepo.create({
        projectId,
        inviteeEmail: email,
        token,
        invitedById: user.id,
        role: dto.role,
        status: ProjectInvitationStatus.PENDING,
      }),
    );

    const inviteLink = `${this.FRONTEND_URL}/registro?project_token=${token}`;
    try {
      await this.emailService.sendInvitation(email, inviteLink, user.name);
    } catch {
      // invitation saved even if email fails
    }

    return invitation;
  }

  async removeMember(
    projectId: string,
    memberUserId: string,
    user: User,
  ): Promise<void> {
    const project = await this.repo.findOneBy({ id: projectId });
    if (!project) throw new NotFoundException("Proyecto no encontrado");
    if (!(await this.canManageMembers(user, project))) {
      throw new ForbiddenException("Sin permiso para eliminar miembros");
    }
    if (project.clientId === memberUserId) {
      throw new BadRequestException("No se puede eliminar al dueño del proyecto");
    }

    const member = await this.memberRepo.findOne({
      where: { projectId, userId: memberUserId },
    });
    if (!member) throw new NotFoundException("Miembro no encontrado");
    await this.memberRepo.remove(member);
  }

  private generateToken(email: string, projectId: string): string {
    const timestamp = Date.now().toString();
    const payload = `${email}:${projectId}:${timestamp}`;
    const signature = crypto
      .createHmac("sha256", this.TOKEN_SECRET)
      .update(payload)
      .digest("hex");
    return Buffer.from(`${payload}:${signature}`).toString("base64url");
  }
}
