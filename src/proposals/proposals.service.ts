import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Not, Repository } from "typeorm";
import {
  Proposal,
  ProposalStatus,
  ProposalType,
} from "./proposal.entity";
import { ProposalDepartment } from "./entities/proposal-department.entity";
import { ProposalSection } from "./entities/proposal-section.entity";
import {
  ProposalComment,
  ProposalCommentVisibility,
} from "./entities/proposal-comment.entity";
import { User, UserRole } from "../users/user.entity";
import { MarketCode } from "../common/market";
import { Project, ProjectStatus } from "../projects/project.entity";
import { ProjectDepartment } from "../projects/entities/project-department.entity";
import { MaterialList } from "../material-lists/material-list.entity";
import { Product } from "../products/product.entity";
import {
  CreateDirectSaleDto,
  CreateManualProposalDto,
  CreateProposalCommentDto,
  CreateProposalDto,
  ManualMaterialDto,
  ManualSectionDto,
  UpdateManualProposalDto,
  UpdateMaterialListDto,
  UpdateProposalStatusDto,
} from "./proposal.dto";
import { EmailService } from "../email/email.service";
import { ProjectsService } from "../projects/projects.service";
import { generateProformaPdfBuffer } from "../pdf/proforma-pdf.template";
import { MarketSettingsService } from "../admin/market-settings.service";

@Injectable()
export class ProposalsService {
  constructor(
    @InjectRepository(Proposal)
    private readonly repo: Repository<Proposal>,
    @InjectRepository(ProposalDepartment)
    private readonly proposalDeptRepo: Repository<ProposalDepartment>,
    @InjectRepository(ProposalSection)
    private readonly sectionRepo: Repository<ProposalSection>,
    @InjectRepository(ProposalComment)
    private readonly commentRepo: Repository<ProposalComment>,
    @InjectRepository(Project)
    private readonly projectsRepo: Repository<Project>,
    @InjectRepository(ProjectDepartment)
    private readonly projectDeptRepo: Repository<ProjectDepartment>,
    @InjectRepository(MaterialList)
    private readonly materialsRepo: Repository<MaterialList>,
    @InjectRepository(Product)
    private readonly productsRepo: Repository<Product>,
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    private readonly emailService: EmailService,
    private readonly projectsService: ProjectsService,
    private readonly marketSettingsService: MarketSettingsService,
  ) {}

  private getProposalClientId(proposal: Proposal): string | null {
    return proposal.clientId ?? proposal.project?.clientId ?? null;
  }

  private canAccessProposal(proposal: Proposal, user: User): boolean {
    const clientId = this.getProposalClientId(proposal);
    const isClient = clientId === user.id;
    const isAuthor = proposal.professionalId === user.id;
    const isCreator = proposal.createdById === user.id;
    return isClient || isAuthor || isCreator || user.role === UserRole.ADMIN;
  }

  async listByProject(projectId: string, requestingUser: User): Promise<Proposal[]> {
    const project = await this.projectsRepo.findOneBy({ id: projectId });
    if (!project) throw new NotFoundException("Proyecto no encontrado");

    const canView = await this.projectsService.canViewProject(requestingUser, project);
    if (!canView) throw new ForbiddenException("Sin acceso al proyecto");

    const isOwnerOrEditor =
      project.clientId === requestingUser.id ||
      (await this.projectsService.canEditProject(requestingUser, project));

    if (isOwnerOrEditor || requestingUser.role === UserRole.ADMIN) {
      return this.repo.find({
        where: { projectId },
        relations: ["proposalDepartments"],
        order: { createdAt: "DESC" },
      });
    }

    return this.repo.find({
      where: { projectId, professionalId: requestingUser.id },
      relations: ["proposalDepartments"],
      order: { createdAt: "DESC" },
    });
  }

  async listSolicitudes(user: User, market?: MarketCode): Promise<Proposal[]> {
    if (user.role === UserRole.ADMIN) {
      const qb = this.repo
        .createQueryBuilder("proposal")
        .leftJoinAndSelect("proposal.client", "client")
        .leftJoinAndSelect("proposal.createdBy", "createdBy")
        .where("proposal.type IN (:...types)", {
          types: [ProposalType.SOLICITUD, ProposalType.DIRECT_SALE],
        })
        .orderBy("proposal.createdAt", "DESC");

      if (market) {
        qb.andWhere("client.country = :market", { market });
      }

      return qb.getMany();
    }
    return this.repo.find({
      where: [
        { type: ProposalType.SOLICITUD, clientId: user.id },
        { type: ProposalType.DIRECT_SALE, clientId: user.id },
        { type: ProposalType.SOLICITUD, createdById: user.id },
      ],
      relations: ["client"],
      order: { createdAt: "DESC" },
    });
  }

  async create(projectId: string, dto: CreateProposalDto, professional: User): Promise<Proposal> {
    if (professional.role !== UserRole.PROFESSIONAL || !professional.isVerified) {
      throw new ForbiddenException("Solo profesionales verificados pueden enviar propuestas");
    }

    const project = await this.projectsRepo.findOne({
      where: { id: projectId },
      relations: ["departments"],
    });
    if (!project) throw new NotFoundException("Proyecto no encontrado");

    if (project.country !== professional.country) {
      throw new ForbiddenException(
        "Solo puedes licitar en proyectos de tu mismo mercado (país de tienda)",
      );
    }

    const projectDeptIds = project.departments.map((d) => d.id);
    for (const deptDto of dto.departments) {
      if (!projectDeptIds.includes(deptDto.projectDepartmentId)) {
        throw new BadRequestException(`Departamento ${deptDto.projectDepartmentId} no pertenece al proyecto`);
      }
    }

    const totalLaborCost = dto.departments.reduce((sum, d) => sum + d.partialLaborCost, 0);

    const proposal = this.repo.create({
      type: ProposalType.PROJECT,
      projectId,
      clientId: project.clientId,
      createdById: professional.id,
      professionalId: professional.id,
      laborCost: totalLaborCost,
      message: dto.message ?? null,
    });
    const savedProposal = await this.repo.save(proposal);

    const proposalDepartments = dto.departments.map((deptDto) =>
      this.proposalDeptRepo.create({
        proposalId: savedProposal.id,
        projectDepartmentId: deptDto.projectDepartmentId,
        partialLaborCost: deptDto.partialLaborCost,
        estimatedDays: deptDto.estimatedDays ?? null,
      }),
    );
    await this.proposalDeptRepo.save(proposalDepartments);

    if (dto.materials?.length) {
      await this.saveMaterials(savedProposal.id, dto.materials);
    }

    if (project.status === ProjectStatus.OPEN) {
      project.status = ProjectStatus.REVIEWING;
      await this.projectsRepo.save(project);
    }

    return savedProposal;
  }

  async createDirectSale(dto: CreateDirectSaleDto, admin: User): Promise<Proposal> {
    if (admin.role !== UserRole.ADMIN) {
      throw new ForbiddenException("Solo administradores");
    }

    const client = await this.usersRepo.findOneBy({ id: dto.clientId });
    if (!client) throw new NotFoundException("Cliente no encontrado");

    const proposal = this.repo.create({
      type: ProposalType.DIRECT_SALE,
      clientId: dto.clientId,
      createdById: admin.id,
      laborCost: dto.laborCost ?? 0,
      message: dto.message ?? null,
      status: ProposalStatus.PENDING,
    });
    const saved = await this.repo.save(proposal);

    if (dto.materials?.length) {
      await this.saveMaterials(saved.id, dto.materials);
    }

    return this.findOne(saved.id, admin);
  }

  async createManual(dto: CreateManualProposalDto, admin: User): Promise<Proposal> {
    if (admin.role !== UserRole.ADMIN) {
      throw new ForbiddenException("Solo administradores");
    }

    const client = await this.usersRepo.findOneBy({ id: dto.clientId });
    if (!client || client.role !== UserRole.CLIENT) {
      throw new NotFoundException("Cliente no encontrado");
    }

    const defaultTax = client.taxExempt
      ? 0
      : client.taxRate !== undefined && client.taxRate !== null
        ? Number(client.taxRate)
        : await this.marketSettingsService.getDefaultTaxRate(client.country);

    const externalComment = dto.externalComment?.trim() || null;
    const internalComment = dto.internalComment?.trim() || null;
    const message = externalComment ?? dto.message ?? null;

    const proposal = this.repo.create({
      type: ProposalType.DIRECT_SALE,
      clientId: dto.clientId,
      createdById: admin.id,
      laborCost: dto.laborCost ?? 0,
      message,
      title: dto.title?.trim() || null,
      taxRate: dto.taxRate !== undefined ? dto.taxRate : defaultTax,
      status: ProposalStatus.PENDING,
    });
    const saved = await this.repo.save(proposal);

    await this.replaceSectionsAndMaterials(saved.id, dto.sections, dto.materials);

    if (externalComment) {
      await this.commentRepo.save(
        this.commentRepo.create({
          proposalId: saved.id,
          authorId: admin.id,
          content: externalComment,
          visibility: ProposalCommentVisibility.CLIENT,
        }),
      );
    }
    if (internalComment) {
      await this.commentRepo.save(
        this.commentRepo.create({
          proposalId: saved.id,
          authorId: admin.id,
          content: internalComment,
          visibility: ProposalCommentVisibility.INTERNAL,
        }),
      );
    }

    return this.findOne(saved.id, admin);
  }

  async updateManual(
    id: string,
    dto: UpdateManualProposalDto,
    admin: User,
  ): Promise<Proposal> {
    if (admin.role !== UserRole.ADMIN) {
      throw new ForbiddenException("Solo administradores");
    }

    const proposal = await this.repo.findOneBy({ id });
    if (!proposal) throw new NotFoundException("Propuesta no encontrada");

    if (dto.clientId !== undefined) {
      const client = await this.usersRepo.findOneBy({ id: dto.clientId });
      if (!client || client.role !== UserRole.CLIENT) {
        throw new NotFoundException("Cliente no encontrado");
      }
      proposal.clientId = dto.clientId;
    }
    if (dto.title !== undefined) proposal.title = dto.title?.trim() || null;
    if (dto.taxRate !== undefined) proposal.taxRate = dto.taxRate;
    if (dto.laborCost !== undefined) proposal.laborCost = dto.laborCost;
    if (dto.message !== undefined) proposal.message = dto.message;

    await this.repo.save(proposal);

    if (dto.sections !== undefined || dto.materials !== undefined) {
      await this.replaceSectionsAndMaterials(id, dto.sections, dto.materials);
    }

    return this.findOne(id, admin);
  }

  private async replaceSectionsAndMaterials(
    proposalId: string,
    sections?: ManualSectionDto[],
    flatMaterials?: ManualMaterialDto[],
  ): Promise<void> {
    const existing = await this.materialsRepo.find({ where: { proposalId } });
    const previousOrdered = new Map<string, number>();
    for (const m of existing) {
      const prev = previousOrdered.get(m.productSku) ?? 0;
      previousOrdered.set(m.productSku, prev + (m.orderedQuantity ?? 0));
    }

    await this.materialsRepo.delete({ proposalId });
    await this.sectionRepo.delete({ proposalId });

    if (sections?.length) {
      for (let i = 0; i < sections.length; i++) {
        const sectionDto = sections[i];
        const section = await this.sectionRepo.save(
          this.sectionRepo.create({
            proposalId,
            name: sectionDto.name?.trim() || `Sección ${i + 1}`,
            sortOrder: sectionDto.sortOrder ?? i,
          }),
        );
        if (sectionDto.materials?.length) {
          await this.saveManualMaterials(
            proposalId,
            sectionDto.materials,
            section.id,
            previousOrdered,
          );
        }
      }
      return;
    }

    if (flatMaterials?.length) {
      await this.saveManualMaterials(proposalId, flatMaterials, null, previousOrdered);
    }
  }

  private async saveManualMaterials(
    proposalId: string,
    materials: ManualMaterialDto[],
    sectionId: string | null,
    previousOrdered: Map<string, number>,
  ): Promise<void> {
    const records = await Promise.all(
      materials.map(async (materialDto) => {
        const product = await this.productsRepo.findOne({
          where: { sku: materialDto.productSku },
        });
        if (!product && !materialDto.productName) {
          throw new NotFoundException(`Producto ${materialDto.productSku} no encontrado`);
        }
        const carry = previousOrdered.get(materialDto.productSku) ?? 0;
        previousOrdered.set(materialDto.productSku, 0);
        return this.materialsRepo.create({
          proposalId,
          sectionId,
          productSku: materialDto.productSku,
          productName: materialDto.productName ?? product!.name,
          quantity: materialDto.quantity,
          orderedQuantity: Math.min(carry, materialDto.quantity),
          suggestedPrice:
            materialDto.suggestedPrice !== undefined
              ? materialDto.suggestedPrice
              : product
                ? Number(product.pvpPrice)
                : 0,
        });
      }),
    );
    await this.materialsRepo.save(records);
  }

  async createFromCart(user: User, message?: string): Promise<Proposal> {
    if (user.role !== UserRole.CLIENT && user.role !== UserRole.PROFESSIONAL) {
      throw new ForbiddenException("Solo clientes y profesionales pueden enviar solicitudes");
    }

    throw new BadRequestException("Use CartService.submitSolicitud");
  }

  private async saveMaterials(
    proposalId: string,
    materials: { dekoramaSku: string; quantity: number }[],
  ): Promise<void> {
    const records = await Promise.all(
      materials.map(async (materialDto) => {
        const product = await this.productsRepo.findOne({
          where: { sku: materialDto.dekoramaSku },
        });
        if (!product) {
          throw new NotFoundException(`Producto ${materialDto.dekoramaSku} no encontrado`);
        }
        return this.materialsRepo.create({
          proposalId,
          productSku: materialDto.dekoramaSku,
          productName: product.name,
          quantity: materialDto.quantity,
          suggestedPrice: product.pvpPrice,
        });
      }),
    );
    await this.materialsRepo.save(records);
  }

  async updateStatus(id: string, dto: UpdateProposalStatusDto, requestingUser: User): Promise<Proposal> {
    const proposal = await this.repo.findOne({
      where: { id },
      relations: ["project"],
    });
    if (!proposal) throw new NotFoundException("Propuesta no encontrada");

    const clientId = this.getProposalClientId(proposal);
    if (clientId !== requestingUser.id && requestingUser.role !== UserRole.ADMIN) {
      throw new ForbiddenException("Solo el cliente puede rechazar");
    }
    proposal.status = ProposalStatus.REJECTED;
    return this.repo.save(proposal);
  }

  async submitProforma(id: string, user: User): Promise<Proposal> {
    const proposal = await this.repo.findOneBy({ id });
    if (!proposal) throw new NotFoundException("Propuesta no encontrada");

    if (proposal.type === ProposalType.PROJECT) {
      if (proposal.professionalId !== user.id) {
        throw new ForbiddenException("Solo el autor puede finalizar la proforma");
      }
      if (proposal.status !== ProposalStatus.PENDING) {
        throw new BadRequestException("Solo se puede finalizar una propuesta pendiente");
      }
    } else {
      if (user.role !== UserRole.ADMIN) {
        throw new ForbiddenException("Solo admin puede preparar proformas de solicitudes");
      }
      if (
        proposal.status !== ProposalStatus.SOLICITUD_SUBMITTED &&
        proposal.status !== ProposalStatus.PENDING
      ) {
        throw new BadRequestException("Estado inválido para generar proforma");
      }
    }

    proposal.status = ProposalStatus.PROFORMA_READY;
    return this.repo.save(proposal);
  }

  async sendProformaEmail(id: string, user: User): Promise<{ sent: boolean }> {
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException("Solo administradores");
    }

    const proposal = await this.repo.findOne({
      where: { id },
      relations: ["client"],
    });
    if (!proposal) throw new NotFoundException("Propuesta no encontrada");
    if (proposal.status !== ProposalStatus.PROFORMA_READY) {
      throw new BadRequestException("La proforma debe estar lista");
    }

    const client = proposal.client ?? (await this.usersRepo.findOneBy({ id: proposal.clientId! }));
    if (!client) throw new BadRequestException("Cliente no encontrado");

    const pdf = await this.generateProformaPdf(id, user);
    const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:3000";
    await this.emailService.sendProforma(
      client.email,
      client.name ?? client.email,
      `${frontendUrl}/solicitudes/${id}`,
      pdf,
    );

    return { sent: true };
  }

  async updateMaterials(
    id: string,
    dto: UpdateMaterialListDto,
    user: User,
  ): Promise<MaterialList[]> {
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException("Solo administradores");
    }

    const proposal = await this.repo.findOneBy({ id });
    if (!proposal) throw new NotFoundException("Propuesta no encontrada");

    const existing = await this.materialsRepo.find({ where: { proposalId: id } });
    const orderedByKey = new Map(
      existing.map((m) => [`${m.productSku}:${m.sectionId ?? ""}`, m.orderedQuantity]),
    );

    await this.materialsRepo.delete({ proposalId: id });

    if (dto.materials.length === 0) return [];

    const records = dto.materials.map((m) =>
      this.materialsRepo.create({
        proposalId: id,
        sectionId: m.sectionId ?? null,
        productSku: m.productSku,
        productName: m.productName,
        quantity: m.quantity,
        orderedQuantity:
          orderedByKey.get(`${m.productSku}:${m.sectionId ?? ""}`) ?? 0,
        suggestedPrice: m.suggestedPrice,
      }),
    );
    return this.materialsRepo.save(records);
  }

  async getMaterials(proposalId: string): Promise<MaterialList[]> {
    return this.materialsRepo.find({
      where: { proposalId },
      relations: ["section"],
      order: { productName: "ASC" },
    });
  }

  async getSections(proposalId: string): Promise<ProposalSection[]> {
    return this.sectionRepo.find({
      where: { proposalId },
      order: { sortOrder: "ASC" },
    });
  }

  async listComments(proposalId: string, user: User): Promise<ProposalComment[]> {
    const proposal = await this.findOne(proposalId, user);
    void proposal;

    const qb = this.commentRepo
      .createQueryBuilder("c")
      .leftJoinAndSelect("c.author", "author")
      .where("c.proposalId = :proposalId", { proposalId })
      .orderBy("c.createdAt", "ASC");

    if (user.role !== UserRole.ADMIN) {
      qb.andWhere("c.visibility = :visibility", {
        visibility: ProposalCommentVisibility.CLIENT,
      });
    }

    const comments = await qb.getMany();
    for (const comment of comments) {
      if (comment.author) {
        const { passwordHash: _pw, ...safe } = comment.author as User & {
          passwordHash?: string;
        };
        comment.author = safe as User;
      }
    }
    return comments;
  }

  async addComment(
    proposalId: string,
    dto: CreateProposalCommentDto,
    user: User,
  ): Promise<ProposalComment> {
    await this.findOne(proposalId, user);

    if (!dto.content?.trim()) {
      throw new BadRequestException("El comentario no puede estar vacío");
    }

    const visibility = dto.visibility ?? ProposalCommentVisibility.CLIENT;
    if (
      visibility === ProposalCommentVisibility.INTERNAL &&
      user.role !== UserRole.ADMIN
    ) {
      throw new ForbiddenException("Solo administradores pueden crear notas internas");
    }

    const comment = await this.commentRepo.save(
      this.commentRepo.create({
        proposalId,
        authorId: user.id,
        content: dto.content.trim(),
        visibility,
      }),
    );

    const saved = await this.commentRepo.findOne({
      where: { id: comment.id },
      relations: ["author"],
    });
    if (!saved) throw new NotFoundException("Comentario no encontrado");
    if (saved.author) {
      const { passwordHash: _pw, ...safe } = saved.author as User & {
        passwordHash?: string;
      };
      saved.author = safe as User;
    }
    return saved;
  }

  async sign(id: string, client: User): Promise<Proposal> {
    const proposal = await this.repo.findOne({
      where: { id },
      relations: ["project"],
    });
    if (!proposal) throw new NotFoundException("Propuesta no encontrada");

    const clientId = this.getProposalClientId(proposal);
    if (clientId !== client.id) {
      throw new ForbiddenException("Solo el cliente puede firmar");
    }
    if (proposal.status !== ProposalStatus.PROFORMA_READY) {
      throw new BadRequestException("Solo se puede firmar una proforma lista");
    }

    proposal.status = ProposalStatus.SIGNED;
    await this.repo.save(proposal);

    if (proposal.type === ProposalType.PROJECT && proposal.projectId) {
      await this.repo.update(
        {
          projectId: proposal.projectId,
          id: Not(proposal.id),
          status: In([ProposalStatus.PENDING, ProposalStatus.PROFORMA_READY]),
        },
        { status: ProposalStatus.REJECTED },
      );

      const project = await this.projectsRepo.findOneBy({ id: proposal.projectId });
      if (project) {
        project.status = ProjectStatus.IN_PROGRESS;
        await this.projectsRepo.save(project);
      }
    }

    return proposal;
  }

  async findOne(id: string, requestingUser: User): Promise<Proposal> {
    const proposal = await this.repo.findOne({
      where: { id },
      relations: [
        "project",
        "professional",
        "client",
        "createdBy",
        "proposalDepartments",
        "sections",
      ],
    });
    if (!proposal) throw new NotFoundException("Propuesta no encontrada");
    if (!this.canAccessProposal(proposal, requestingUser)) {
      throw new ForbiddenException("Acceso denegado");
    }
    if (proposal.sections?.length) {
      proposal.sections.sort((a, b) => a.sortOrder - b.sortOrder);
    }
    if (proposal.professional) {
      const { passwordHash: _pw, ...safe } = proposal.professional as User & { passwordHash?: string };
      proposal.professional = safe as User;
    }
    if (proposal.client) {
      const { passwordHash: _pw, ...safe } = proposal.client as User & { passwordHash?: string };
      proposal.client = safe as User;
    }
    return proposal;
  }

  async listMine(user: User): Promise<Proposal[]> {
    if (user.role === UserRole.PROFESSIONAL) {
      return this.repo.find({
        where: { professionalId: user.id },
        relations: ["project", "proposalDepartments"],
        order: { createdAt: "DESC" },
      });
    }
    if (user.role === UserRole.ADMIN) {
      return this.repo.find({
        relations: ["project", "client", "proposalDepartments"],
        order: { createdAt: "DESC" },
      });
    }
    return this.repo
      .createQueryBuilder("p")
      .leftJoinAndSelect("p.project", "project")
      .leftJoinAndSelect("p.proposalDepartments", "proposalDepartments")
      .where("project.clientId = :clientId OR p.clientId = :clientId", { clientId: user.id })
      .orderBy("p.createdAt", "DESC")
      .getMany();
  }

  async generateProformaPdf(id: string, requestingUser: User): Promise<Buffer> {
    const proposal = await this.findOne(id, requestingUser);
    const materials = await this.materialsRepo.find({ where: { proposalId: id } });

    const clientId = this.getProposalClientId(proposal);
    const client =
      proposal.client ??
      (clientId ? await this.usersRepo.findOneBy({ id: clientId }) : null);
    if (!client) {
      throw new BadRequestException("Cliente no encontrado para generar la proforma");
    }

    const taxRate =
      proposal.taxRate !== undefined && proposal.taxRate !== null
        ? Number(proposal.taxRate)
        : client.taxExempt
          ? 0
          : client.taxRate !== undefined && client.taxRate !== null
            ? Number(client.taxRate)
            : await this.marketSettingsService.getDefaultTaxRate(client.country);
    return generateProformaPdfBuffer(proposal, client, materials, taxRate);
  }
}
