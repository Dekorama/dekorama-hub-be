import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import { UserRole } from "../../users/user.entity";

@Injectable()
export class VerifiedProfessionalGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const user = req.user;

    if (!user) {
      throw new ForbiddenException("User not attached to request");
    }

    if (user.role !== UserRole.PROFESSIONAL) {
      throw new ForbiddenException("Only professionals can perform this action");
    }

    if (!user.isVerified) {
      throw new ForbiddenException(
        "Professional account must be verified to perform this action"
      );
    }

    return true;
  }
}
