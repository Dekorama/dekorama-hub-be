import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { UserRole } from "../../users/user.entity";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<UserRole[]>(
      "roles",
      context.getHandler()
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true; // No role requirement
    }

    const req = context.switchToHttp().getRequest();
    const user = req.user;

    if (!user) {
      throw new ForbiddenException("User not attached to request");
    }

    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException(
        `Requires one of: ${requiredRoles.join(", ")}`
      );
    }

    return true;
  }
}
