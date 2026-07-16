import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import { Request } from "express";
import { AuthService } from "../auth.service";
import { readSessionUserId } from "../session";

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const userId = readSessionUserId(req);

    if (!userId) {
      throw new UnauthorizedException("No session found");
    }

    const user = await this.authService.findById(userId);
    if (!user) {
      throw new UnauthorizedException("Invalid session");
    }

    (req as Request & { user?: unknown }).user = user;
    return true;
  }
}
