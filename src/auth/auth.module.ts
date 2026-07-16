import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { User } from "../users/user.entity";
import { CommunityInvitation } from "../communities/entities/community-invitation.entity";
import { CommunityResidentProfile } from "../communities/entities/community-resident-profile.entity";
import { AdminInvitation } from "../admin/entities/admin-invitation.entity";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { SessionGuard } from "./guards/session.guard";
import { RolesGuard } from "./guards/roles.guard";
import { VerifiedProfessionalGuard } from "./guards/verified-professional.guard";

@Module({
  imports: [TypeOrmModule.forFeature([User, CommunityInvitation, CommunityResidentProfile, AdminInvitation])],
  providers: [
    AuthService,
    SessionGuard,
    RolesGuard,
    VerifiedProfessionalGuard,
  ],
  controllers: [AuthController],
  exports: [AuthService, SessionGuard, RolesGuard, VerifiedProfessionalGuard],
})
export class AuthModule {}
