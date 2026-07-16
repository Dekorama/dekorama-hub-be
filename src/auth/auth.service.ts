import { Injectable, UnauthorizedException, BadRequestException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { User, UserRole, AccountType } from "../users/user.entity";
import { MarketCode, isMarketCode } from "../common/market";
import { RegisterDto } from "./dto/register.dto";
import { RegisterMemberDto } from "./dto/register-member.dto";
import { RegisterAdminDto } from "./dto/register-admin.dto";
import { LoginDto } from "./dto/login.dto";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { CommunityInvitation, InvitationStatus } from "../communities/entities/community-invitation.entity";
import { CommunityResidentProfile } from "../communities/entities/community-resident-profile.entity";
import { AdminInvitation, AdminInvitationStatus } from "../admin/entities/admin-invitation.entity";
import * as bcrypt from "bcryptjs";
import * as crypto from "crypto";
import { requireSecret, timingSafeEqualString } from "../common/secrets";

@Injectable()
export class AuthService {
  private readonly TOKEN_SECRET = requireSecret(
    "INVITATION_TOKEN_SECRET",
    "dev-only-invitation-secret-change-me",
  );
  private readonly TOKEN_EXPIRY_DAYS = 7;

  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    @InjectRepository(CommunityInvitation)
    private readonly invitationsRepo: Repository<CommunityInvitation>,
    @InjectRepository(CommunityResidentProfile)
    private readonly residentProfileRepo: Repository<CommunityResidentProfile>,
    @InjectRepository(AdminInvitation)
    private readonly adminInvitationsRepo: Repository<AdminInvitation>,
  ) {}

  async register(input: RegisterDto): Promise<User> {
    const existing = await this.usersRepo.findOne({
      where: { email: input.email },
    });
    if (existing) {
      throw new UnauthorizedException("Email ya registrado");
    }

    if (!input.country || !isMarketCode(input.country)) {
      throw new BadRequestException("País de tienda inválido. Use VE o ES.");
    }

    const passwordHash = await bcrypt.hash(input.password, 10);
    const accountType =
      input.role === UserRole.CLIENT
        ? (input.accountType ?? AccountType.INDIVIDUAL)
        : null;

    const user = this.usersRepo.create({
      name: input.name,
      email: input.email,
      passwordHash,
      role: input.role ?? UserRole.CLIENT,
      accountType,
      // Professionals start unverified; admins are seeded directly
      isVerified: input.role === UserRole.PROFESSIONAL ? false : true,
      country: input.country,
      profileData: input.profileData ?? null,
    });
    return this.usersRepo.save(user);
  }

  async validateUser(input: LoginDto): Promise<User> {
    const user = await this.usersRepo.findOne({
      where: { email: input.email },
    });
    if (!user) throw new UnauthorizedException("Credenciales inválidas");
    const ok = await bcrypt.compare(input.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException("Credenciales inválidas");
    return user;
  }

  async findById(id: string): Promise<User | null> {
    return this.usersRepo.findOneBy({ id });
  }

  toPublicUser(user: User) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isVerified: user.isVerified,
      accountType: user.accountType,
      parentAccountId: user.parentAccountId,
      country: user.country,
      profileData: user.profileData,
      createdAt: user.createdAt,
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<User> {
    const user = await this.usersRepo.findOneBy({ id: userId });
    if (!user) throw new UnauthorizedException("Usuario no encontrado");

    if (dto.name !== undefined) {
      const trimmed = dto.name.trim();
      if (trimmed.length < 2) {
        throw new BadRequestException("El nombre debe tener al menos 2 caracteres");
      }
      user.name = trimmed;
    }

    const profileData = { ...(user.profileData ?? {}) } as Record<string, unknown>;

    if (dto.phone !== undefined) profileData.phone = dto.phone.trim();
    if (dto.address !== undefined) profileData.address = dto.address.trim();
    if (dto.city !== undefined) profileData.city = dto.city.trim();
    if (dto.province !== undefined) profileData.province = dto.province.trim();

    if (user.role === UserRole.PROFESSIONAL) {
      if (dto.bio !== undefined) profileData.bio = dto.bio.trim();
      if (dto.specialties !== undefined) {
        profileData.specialties = dto.specialties
          .map((s) => s.trim())
          .filter(Boolean);
      }
    }

    user.profileData = profileData;
    return this.usersRepo.save(user);
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.usersRepo.findOneBy({ id: userId });
    if (!user) throw new UnauthorizedException("Usuario no encontrado");

    if (!dto.currentPassword || !dto.newPassword) {
      throw new BadRequestException("Contraseña actual y nueva son obligatorias");
    }
    if (dto.newPassword.length < 8) {
      throw new BadRequestException("La nueva contraseña debe tener al menos 8 caracteres");
    }

    const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException("Contraseña actual incorrecta");
    }

    user.passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.usersRepo.save(user);
  }

  async registerMember(input: RegisterMemberDto): Promise<User> {
    // Validate token
    const decoded = this.validateToken(input.token);
    if (!decoded) {
      throw new BadRequestException("Token inválido");
    }

    // Find invitation
    const invitation = await this.invitationsRepo.findOne({
      where: { token: input.token, status: InvitationStatus.PENDING },
    });

    if (!invitation) {
      throw new BadRequestException("Invitación no encontrada o ya utilizada");
    }

    // Check expiry
    const expiryDate = new Date(invitation.createdAt);
    expiryDate.setDate(expiryDate.getDate() + this.TOKEN_EXPIRY_DAYS);
    if (new Date() > expiryDate) {
      invitation.status = InvitationStatus.EXPIRED;
      await this.invitationsRepo.save(invitation);
      throw new BadRequestException("Invitación expirada");
    }

    // Verify email matches
    if (invitation.inviteeEmail !== input.email) {
      throw new BadRequestException("El email no coincide con la invitación");
    }

    // Check if user already exists
    const existing = await this.usersRepo.findOne({
      where: { email: input.email },
    });
    if (existing) {
      throw new BadRequestException("Email ya registrado");
    }

    // Create member user
    const organizer = await this.usersRepo.findOneBy({ id: invitation.organizerId });
    const passwordHash = await bcrypt.hash(input.password, 10);
    const user = this.usersRepo.create({
      name: input.name,
      email: input.email,
      passwordHash,
      role: UserRole.CLIENT,
      accountType: AccountType.MEMBER,
      parentAccountId: invitation.organizerId,
      country: organizer?.country ?? MarketCode.VE,
      isVerified: true,
    });
    const savedUser = await this.usersRepo.save(user);

    await this.residentProfileRepo.save(
      this.residentProfileRepo.create({
        userId: savedUser.id,
        isOccupant: true,
      }),
    );

    // Mark invitation as accepted
    invitation.status = InvitationStatus.ACCEPTED;
    await this.invitationsRepo.save(invitation);

    return savedUser;
  }

  private validateToken(token: string): { email: string; organizerId: string } | null {
    try {
      const decoded = Buffer.from(token, "base64url").toString();
      const [email, organizerId, timestamp, signature] = decoded.split(":");
      
      const payload = `${email}:${organizerId}:${timestamp}`;
      const expectedSignature = crypto
        .createHmac("sha256", this.TOKEN_SECRET)
        .update(payload)
        .digest("hex");

      if (!timingSafeEqualString(signature, expectedSignature)) return null;
      return { email, organizerId };
    } catch {
      return null;
    }
  }

  async registerAdmin(input: RegisterAdminDto): Promise<User> {
    // Validate token
    const decoded = this.validateAdminToken(input.token);
    if (!decoded) {
      throw new BadRequestException("Token inválido");
    }

    // Find invitation
    const invitation = await this.adminInvitationsRepo.findOne({
      where: { token: input.token },
    });

    if (!invitation) {
      throw new BadRequestException("Invitación no encontrada");
    }

    if (invitation.status !== AdminInvitationStatus.PENDING) {
      throw new BadRequestException("Invitación ya fue utilizada");
    }

    // Check if email matches
    if (invitation.inviteeEmail !== input.email) {
      throw new BadRequestException("Email no coincide con la invitación");
    }

    // Check expiry
    const expiryDate = new Date(invitation.createdAt);
    expiryDate.setDate(expiryDate.getDate() + this.TOKEN_EXPIRY_DAYS);
    if (new Date() > expiryDate) {
      invitation.status = AdminInvitationStatus.EXPIRED;
      await this.adminInvitationsRepo.save(invitation);
      throw new BadRequestException("Invitación expirada");
    }

    // Check if email already exists
    const existing = await this.usersRepo.findOne({
      where: { email: input.email },
    });
    if (existing) {
      throw new BadRequestException("Email ya registrado");
    }

    // Create admin user
    const passwordHash = await bcrypt.hash(input.password, 10);
    const user = this.usersRepo.create({
      name: input.name,
      email: input.email,
      passwordHash,
      role: UserRole.ADMIN,
      country: MarketCode.VE,
      isVerified: true,
    });
    const savedUser = await this.usersRepo.save(user);

    // Mark invitation as accepted
    invitation.status = AdminInvitationStatus.ACCEPTED;
    await this.adminInvitationsRepo.save(invitation);

    return savedUser;
  }

  private validateAdminToken(token: string): { email: string; senderId: string } | null {
    try {
      const [dataB64, signature] = token.split(".");
      const data = Buffer.from(dataB64, "base64url").toString();
      const expectedSig = crypto
        .createHmac("sha256", this.TOKEN_SECRET)
        .update(data)
        .digest("base64url");
      
      if (!timingSafeEqualString(signature, expectedSig)) return null;

      const [email, senderId] = data.split(":");
      return { email, senderId };
    } catch {
      return null;
    }
  }
}

