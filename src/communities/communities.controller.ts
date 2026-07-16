import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import { Request } from "express";
import { CommunitiesService } from "./communities.service";
import { CreateCommunityInvitationDto } from "./dto/community-invitation.dto";
import { UpdateCommunityMemberDto } from "./dto/community-member.dto";
import { AuthService } from "../auth/auth.service";

@Controller("communities")
export class CommunitiesController {
  constructor(
    private readonly communitiesService: CommunitiesService,
    private readonly authService: AuthService,
  ) {}

  private async requireUser(req: Request) {
    const userId = (req as any).cookies?.["dekorama_session"];
    if (!userId) throw new UnauthorizedException();
    const user = await this.authService.findById(userId);
    if (!user) throw new UnauthorizedException();
    return user;
  }

  @Post("invite")
  async sendInvitations(
    @Body() dto: CreateCommunityInvitationDto,
    @Req() req: Request
  ) {
    const user = await this.requireUser(req);
    return this.communitiesService.createInvitations(user.id, dto);
  }

  @Get("invitations")
  async listInvitations(@Req() req: Request) {
    const user = await this.requireUser(req);
    return this.communitiesService.listInvitations(user.id);
  }

  @Get("accept-invite/:token")
  async acceptInvitation(@Param("token") token: string) {
    return this.communitiesService.acceptInvitation(token);
  }

  @Get("members")
  async listMembers(@Req() req: Request) {
    const user = await this.requireUser(req);
    return this.communitiesService.listMembers(user.id);
  }

  @Patch("members/:userId")
  async updateMember(
    @Param("userId") userId: string,
    @Body() dto: UpdateCommunityMemberDto,
    @Req() req: Request,
  ) {
    const user = await this.requireUser(req);
    return this.communitiesService.updateMember(user.id, userId, dto);
  }
}
