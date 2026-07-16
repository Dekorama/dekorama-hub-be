import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Request } from "express";
import { AccountType, User, UserRole } from "../users/user.entity";
import { AuthService } from "../auth/auth.service";
import { EmailService } from "../email/email.service";
import { AdminInvitation, AdminInvitationStatus } from "./entities/admin-invitation.entity";
import { InviteAdminDto, AcceptAdminInvitationResponseDto } from "./dto/admin-invitation.dto";
import { CreateClientDto } from "./dto/create-client.dto";
import { UpdateMarketSettingsDto } from "./dto/market-settings.dto";
import { MarketSettingsService } from "./market-settings.service";
import { isMarketCode, MarketCode } from "../common/market";
import { parseMarketFilter } from "../common/market-filter";
import { ProjectsService } from "../projects/projects.service";
import { ProjectStatus, ProjectType } from "../projects/project.entity";
import * as crypto from "crypto";
import * as bcrypt from "bcryptjs";

class VerifyUserDto {
  isVerified!: boolean;
}

class UpdateClientTaxDto {
  taxRate?: number | null;
  taxExempt?: boolean;
}

@Controller("admin")
export class AdminController {
  private readonly SECRET = process.env.JWT_SECRET || "dekorama-secret-2026";
  private readonly EXPIRY_DAYS = 7;

  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    @InjectRepository(AdminInvitation)
    private readonly adminInvitationsRepo: Repository<AdminInvitation>,
    private readonly authService: AuthService,
    private readonly emailService: EmailService,
    private readonly marketSettingsService: MarketSettingsService,
    private readonly projectsService: ProjectsService,
  ) {}

  private async requireAdmin(req: Request): Promise<User> {
    const userId = (req as any).cookies?.["dekorama_session"];
    if (!userId) throw new UnauthorizedException();
    const user = await this.authService.findById(userId);
    if (!user) throw new UnauthorizedException();
    if (user.role !== UserRole.ADMIN) throw new ForbiddenException("Solo administradores");
    return user;
  }

  @Get("projects")
  async listProjects(
    @Query("market") market: string,
    @Query("status") status: string,
    @Query("projectType") projectType: string,
    @Query("visibility") visibility: string,
    @Query("search") search: string,
    @Req() req: Request,
  ) {
    await this.requireAdmin(req);

    const isPublic =
      visibility === "public" ? true : visibility === "private" ? false : undefined;

    const validStatuses = Object.values(ProjectStatus);
    const validTypes = Object.values(ProjectType);

    return this.projectsService.listForAdmin({
      country: parseMarketFilter(market),
      status: validStatuses.includes(status as ProjectStatus)
        ? (status as ProjectStatus)
        : undefined,
      projectType: validTypes.includes(projectType as ProjectType)
        ? (projectType as ProjectType)
        : undefined,
      isPublic,
      search,
    });
  }

  @Get("users")
  async listUsers(
    @Query("role") role: string,
    @Query("isVerified") isVerified: string,
    @Query("market") market: string,
    @Req() req: Request,
  ) {
    await this.requireAdmin(req);
    const where: Record<string, unknown> = {};
    if (role) where["role"] = role;
    if (isVerified !== undefined) where["isVerified"] = isVerified === "true";
    if (market && isMarketCode(market)) where["country"] = market;
    return this.usersRepo.find({ where: where as any, order: { createdAt: "DESC" } });
  }

  @Get("markets")
  async listMarkets(@Req() req: Request) {
    await this.requireAdmin(req);
    return this.marketSettingsService.listAll();
  }

  @Get("markets/:code/settings")
  async getMarketSettings(@Param("code") code: string, @Req() req: Request) {
    await this.requireAdmin(req);
    if (!isMarketCode(code)) throw new BadRequestException("Código de mercado inválido");
    return this.marketSettingsService.getByCode(code as MarketCode);
  }

  @Patch("markets/:code/settings")
  async updateMarketSettings(
    @Param("code") code: string,
    @Body() dto: UpdateMarketSettingsDto,
    @Req() req: Request,
  ) {
    await this.requireAdmin(req);
    if (!isMarketCode(code)) throw new BadRequestException("Código de mercado inválido");
    return this.marketSettingsService.update(code as MarketCode, dto);
  }

  @Patch("users/:id/verify")
  async verifyUser(
    @Param("id") id: string,
    @Body() body: VerifyUserDto,
    @Req() req: Request,
  ) {
    await this.requireAdmin(req);
    await this.usersRepo.update(id, { isVerified: body.isVerified });
    return this.usersRepo.findOneBy({ id });
  }

  @Patch("users/:id")
  async updateUser(
    @Param("id") id: string,
    @Body() body: UpdateClientTaxDto,
    @Req() req: Request,
  ) {
    await this.requireAdmin(req);
    const user = await this.usersRepo.findOneBy({ id });
    if (!user) throw new BadRequestException("Usuario no encontrado");
    if (body.taxExempt !== undefined) {
      user.taxExempt = body.taxExempt;
      if (body.taxExempt) user.taxRate = 0;
    }
    if (body.taxRate !== undefined && !user.taxExempt) {
      user.taxRate = body.taxRate;
    }
    return this.usersRepo.save(user);
  }

  @Post("clients")
  async createClient(@Body() body: CreateClientDto, @Req() req: Request) {
    await this.requireAdmin(req);

    if (!body.name?.trim() || !body.email?.trim()) {
      throw new BadRequestException("Nombre y email son obligatorios");
    }
    if (!isMarketCode(body.country)) {
      throw new BadRequestException("Código de mercado inválido");
    }

    const existing = await this.usersRepo.findOneBy({
      email: body.email.trim().toLowerCase(),
    });
    if (existing) {
      throw new BadRequestException("Ya existe un usuario con ese email");
    }

    const password =
      body.password && body.password.length >= 6
        ? body.password
        : crypto.randomBytes(12).toString("base64url");
    const passwordHash = await bcrypt.hash(password, 10);

    const client = this.usersRepo.create({
      name: body.name.trim(),
      email: body.email.trim().toLowerCase(),
      passwordHash,
      role: UserRole.CLIENT,
      accountType: AccountType.INDIVIDUAL,
      country: body.country as MarketCode,
      profileData: body.profileData ?? null,
      taxExempt: body.taxExempt ?? false,
      taxRate: body.taxExempt ? 0 : (body.taxRate ?? null),
      isVerified: true,
    });
    const saved = await this.usersRepo.save(client);
    const { passwordHash: _pw, ...safe } = saved;
    return { ...safe, temporaryPassword: body.password ? undefined : password };
  }

  @Post("invite")
  async inviteAdmins(@Body() dto: InviteAdminDto, @Req() req: Request) {
    const sender = await this.requireAdmin(req);
    const frontendUrl = process.env.FRONTEND_ORIGIN || "http://localhost:3000";
    const invitations: AdminInvitation[] = [];

    for (const email of dto.emails) {
      const token = this.generateToken(email, sender.id);
      const invitation = this.adminInvitationsRepo.create({
        senderId: sender.id,
        inviteeEmail: email,
        token,
        status: AdminInvitationStatus.PENDING,
      });
      await this.adminInvitationsRepo.save(invitation);
      invitations.push(invitation);

      const inviteLink = `${frontendUrl}/registro?admin_token=${token}`;
      await this.emailService.sendAdminInvitation(email, inviteLink, sender.name);
    }

    return invitations;
  }

  @Get("invitations")
  async listInvitations(@Req() req: Request) {
    const sender = await this.requireAdmin(req);
    return this.adminInvitationsRepo.find({
      where: { senderId: sender.id },
      order: { createdAt: "DESC" },
    });
  }

  @Get("accept-invite/:token")
  async validateInvitation(
    @Param("token") token: string,
  ): Promise<AcceptAdminInvitationResponseDto> {
    const decoded = this.validateToken(token);
    if (!decoded) {
      throw new BadRequestException("Token inválido");
    }

    const invitation = await this.adminInvitationsRepo.findOne({
      where: { token },
      relations: ["sender"],
    });

    if (!invitation) {
      throw new BadRequestException("Invitación no encontrada");
    }

    if (invitation.status !== AdminInvitationStatus.PENDING) {
      throw new BadRequestException("Invitación ya fue utilizada");
    }

    const expiryDate = new Date(invitation.createdAt);
    expiryDate.setDate(expiryDate.getDate() + this.EXPIRY_DAYS);
    if (new Date() > expiryDate) {
      invitation.status = AdminInvitationStatus.EXPIRED;
      await this.adminInvitationsRepo.save(invitation);
      throw new BadRequestException("Invitación expirada");
    }

    return {
      senderName: invitation.sender.name,
      senderEmail: invitation.sender.email,
      inviteeEmail: invitation.inviteeEmail,
    };
  }

  private generateToken(email: string, senderId: string): string {
    const timestamp = Date.now().toString();
    const data = `${email}:${senderId}:${timestamp}`;
    const signature = crypto.createHmac("sha256", this.SECRET).update(data).digest("base64url");
    return `${Buffer.from(data).toString("base64url")}.${signature}`;
  }

  private validateToken(token: string): { email: string; senderId: string; timestamp: number } | null {
    try {
      const [dataB64, signature] = token.split(".");
      const data = Buffer.from(dataB64, "base64url").toString();
      const expectedSig = crypto.createHmac("sha256", this.SECRET).update(data).digest("base64url");
      
      if (signature !== expectedSig) return null;

      const [email, senderId, timestamp] = data.split(":");
      return { email, senderId, timestamp: parseInt(timestamp) };
    } catch {
      return null;
    }
  }
}
