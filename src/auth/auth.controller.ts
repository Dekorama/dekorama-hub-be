import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from "@nestjs/common";
import { AuthService } from "./auth.service";
import { RegisterDto } from "./dto/register.dto";
import { RegisterMemberDto } from "./dto/register-member.dto";
import { RegisterAdminDto } from "./dto/register-admin.dto";
import { LoginDto } from "./dto/login.dto";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { Request, Response } from "express";

const SESSION_COOKIE = "dekorama_session";

function sessionCookieOptions() {
  const crossSite = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    sameSite: crossSite ? ("none" as const) : ("lax" as const),
    secure: crossSite,
  };
}

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private async requireUser(req: Request) {
    const userId = (req as Request & { cookies?: Record<string, string> }).cookies?.[SESSION_COOKIE];
    if (!userId) throw new UnauthorizedException();
    const user = await this.authService.findById(userId);
    if (!user) throw new UnauthorizedException();
    return user;
  }

  @Post("register")
  async register(@Body() body: RegisterDto) {
    const user = await this.authService.register(body);
    return { id: user.id, email: user.email, name: user.name, role: user.role, isVerified: user.isVerified };
  }

  @Post("register-member")
  async registerMember(
    @Body() body: RegisterMemberDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.authService.registerMember(body);
    // Auto-login the new member
    res.cookie(SESSION_COOKIE, user.id, sessionCookieOptions());
    return { id: user.id, email: user.email, name: user.name, role: user.role, accountType: user.accountType, parentAccountId: user.parentAccountId };
  }

  @Post("register-admin")
  async registerAdmin(
    @Body() body: RegisterAdminDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.authService.registerAdmin(body);
    // Auto-login the new admin
    res.cookie(SESSION_COOKIE, user.id, sessionCookieOptions());
    return { id: user.id, email: user.email, name: user.name, role: user.role, isVerified: user.isVerified };
  }

  @Post("login")
  async login(
    @Body() body: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.authService.validateUser(body);
    res.cookie(SESSION_COOKIE, user.id, sessionCookieOptions());
    return { id: user.id, email: user.email, name: user.name, role: user.role, isVerified: user.isVerified };
  }

  @Post("logout")
  async logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(SESSION_COOKIE, sessionCookieOptions());
    return { ok: true };
  }

  @Get("me")
  async me(@Req() req: Request) {
    const userId = (req as any).cookies?.[SESSION_COOKIE];
    if (!userId) return null;
    const user = await this.authService.findById(userId);
    if (!user) return null;
    return this.authService.toPublicUser(user);
  }

  @Patch("profile")
  async updateProfile(@Req() req: Request, @Body() body: UpdateProfileDto) {
    const user = await this.requireUser(req);
    const updated = await this.authService.updateProfile(user.id, body);
    return this.authService.toPublicUser(updated);
  }

  @Patch("password")
  async changePassword(@Req() req: Request, @Body() body: ChangePasswordDto) {
    const user = await this.requireUser(req);
    await this.authService.changePassword(user.id, body);
    return { ok: true };
  }
}

