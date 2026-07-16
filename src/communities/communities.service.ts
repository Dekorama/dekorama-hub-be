import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { CommunityInvitation, InvitationStatus } from "./entities/community-invitation.entity";
import { CommunityResidentProfile } from "./entities/community-resident-profile.entity";
import { User, AccountType } from "../users/user.entity";
import { CreateCommunityInvitationDto, AcceptInvitationResponseDto } from "./dto/community-invitation.dto";
import { UpdateCommunityMemberDto } from "./dto/community-member.dto";
import { EmailService } from "../email/email.service";
import * as crypto from "crypto";

@Injectable()
export class CommunitiesService {
  private readonly TOKEN_SECRET = process.env.INVITATION_TOKEN_SECRET || "dekorama-invitations-secret-change-in-production";
  private readonly TOKEN_EXPIRY_DAYS = 7;
  private readonly FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

  constructor(
    @InjectRepository(CommunityInvitation)
    private readonly invitationsRepo: Repository<CommunityInvitation>,
    @InjectRepository(CommunityResidentProfile)
    private readonly residentProfileRepo: Repository<CommunityResidentProfile>,
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    private readonly emailService: EmailService,
  ) {}

  async createInvitations(
    organizerId: string,
    dto: CreateCommunityInvitationDto
  ): Promise<CommunityInvitation[]> {
    const organizer = await this.usersRepo.findOne({ where: { id: organizerId } });
    if (!organizer) throw new NotFoundException("Usuario no encontrado");
    if (organizer.accountType !== AccountType.COMMUNITY) {
      throw new BadRequestException("Solo organizadores comunitarios pueden enviar invitaciones");
    }

    const invitations: CommunityInvitation[] = [];
    for (const email of dto.emails) {
      // Check if already invited
      const existing = await this.invitationsRepo.findOne({
        where: { organizerId, inviteeEmail: email, status: InvitationStatus.PENDING },
      });
      if (existing) continue; // Skip duplicates

      // Generate token: base64(email:organizerId:timestamp:signature)
      const token = this.generateToken(email, organizerId);
      const invitation = this.invitationsRepo.create({
        organizerId,
        inviteeEmail: email,
        token,
        status: InvitationStatus.PENDING,
      });
      const saved = await this.invitationsRepo.save(invitation);
      invitations.push(saved);

      // Send email
      const inviteLink = `${this.FRONTEND_URL}/registro?token=${token}`;
      try {
        await this.emailService.sendInvitation(email, inviteLink, organizer.name);
      } catch (error) {
        // Log but don't fail - invitation is saved
        console.error(`Failed to send email to ${email}:`, error);
      }
    }

    return invitations;
  }

  async listInvitations(organizerId: string): Promise<CommunityInvitation[]> {
    return this.invitationsRepo.find({
      where: { organizerId },
      order: { createdAt: "DESC" },
    });
  }

  async acceptInvitation(token: string): Promise<AcceptInvitationResponseDto> {
    const decoded = this.validateToken(token);
    if (!decoded) {
      throw new BadRequestException("Token inválido o expirado");
    }

    const invitation = await this.invitationsRepo.findOne({
      where: { token, status: InvitationStatus.PENDING },
      relations: ["organizer"],
    });

    if (!invitation) {
      throw new NotFoundException("Invitación no encontrada o ya utilizada");
    }

    // Check expiry (7 days from createdAt)
    const expiryDate = new Date(invitation.createdAt);
    expiryDate.setDate(expiryDate.getDate() + this.TOKEN_EXPIRY_DAYS);
    if (new Date() > expiryDate) {
      invitation.status = InvitationStatus.EXPIRED;
      await this.invitationsRepo.save(invitation);
      throw new BadRequestException("Invitación expirada");
    }

    return {
      organizerName: invitation.organizer.name,
      organizerEmail: invitation.organizer.email,
      inviteeEmail: invitation.inviteeEmail,
    };
  }

  async markAsAccepted(token: string): Promise<void> {
    const invitation = await this.invitationsRepo.findOne({
      where: { token, status: InvitationStatus.PENDING },
    });
    if (invitation) {
      invitation.status = InvitationStatus.ACCEPTED;
      await this.invitationsRepo.save(invitation);
    }
  }

  async listMembers(organizerId: string) {
    const organizer = await this.usersRepo.findOne({ where: { id: organizerId } });
    if (!organizer) throw new NotFoundException("Usuario no encontrado");
    if (organizer.accountType !== AccountType.COMMUNITY) {
      throw new BadRequestException("Solo organizadores comunitarios pueden ver miembros");
    }

    const members = await this.usersRepo.find({
      where: { parentAccountId: organizerId },
      order: { createdAt: "DESC" },
    });

    const memberIds = members.map((m) => m.id);
    const profiles =
      memberIds.length > 0
        ? await this.residentProfileRepo.find({
            where: { userId: In(memberIds) },
          })
        : [];
    const profileMap = new Map(profiles.map((p) => [p.userId, p]));

    const invitations = await this.invitationsRepo.find({
      where: { organizerId },
      order: { createdAt: "DESC" },
    });

    return members.map((member) => ({
      id: member.id,
      name: member.name,
      email: member.email,
      createdAt: member.createdAt,
      residentProfile: profileMap.get(member.id) ?? null,
      invitation: invitations.find(
        (inv) =>
          inv.inviteeEmail === member.email && inv.status === InvitationStatus.ACCEPTED,
      ) ?? null,
    }));
  }

  async updateMember(
    organizerId: string,
    memberUserId: string,
    dto: UpdateCommunityMemberDto,
  ): Promise<CommunityResidentProfile> {
    const organizer = await this.usersRepo.findOne({ where: { id: organizerId } });
    if (!organizer) throw new NotFoundException("Usuario no encontrado");
    if (organizer.accountType !== AccountType.COMMUNITY) {
      throw new BadRequestException("Solo organizadores comunitarios pueden editar miembros");
    }

    const member = await this.usersRepo.findOne({
      where: { id: memberUserId, parentAccountId: organizerId },
    });
    if (!member) throw new NotFoundException("Miembro no encontrado en la comunidad");

    let profile = await this.residentProfileRepo.findOne({
      where: { userId: memberUserId },
    });
    if (!profile) {
      profile = this.residentProfileRepo.create({ userId: memberUserId });
    }

    if (dto.unitNumber !== undefined) profile.unitNumber = dto.unitNumber || null;
    if (dto.floor !== undefined) profile.floor = dto.floor || null;
    if (dto.isOccupant !== undefined) profile.isOccupant = dto.isOccupant;
    if (dto.notes !== undefined) profile.notes = dto.notes || null;

    return this.residentProfileRepo.save(profile);
  }

  private generateToken(email: string, organizerId: string): string {
    const timestamp = Date.now().toString();
    const payload = `${email}:${organizerId}:${timestamp}`;
    const signature = crypto
      .createHmac("sha256", this.TOKEN_SECRET)
      .update(payload)
      .digest("hex");
    return Buffer.from(`${payload}:${signature}`).toString("base64url");
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

      if (signature !== expectedSignature) return null;
      return { email, organizerId };
    } catch {
      return null;
    }
  }
}
