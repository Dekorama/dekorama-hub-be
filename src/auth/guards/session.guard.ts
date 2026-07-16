import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import { Request } from "express";
import { AuthService } from "../auth.service";

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const userId = (req as any).cookies?.["dekorama_session"];

    if (!userId) {
      throw new UnauthorizedException("No session found");
    }

    const user = await this.authService.findById(userId);
    if (!user) {
      throw new UnauthorizedException("Invalid session");
    }

    // Attach user to request for downstream use
    (req as any).user = user;
    return true;
  }
}
