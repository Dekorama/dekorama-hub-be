import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CommunityInvitation } from "./entities/community-invitation.entity";
import { CommunityResidentProfile } from "./entities/community-resident-profile.entity";
import { User } from "../users/user.entity";
import { CommunitiesService } from "./communities.service";
import { CommunitiesController } from "./communities.controller";
import { AuthModule } from "../auth/auth.module";
import { EmailModule } from "../email/email.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([CommunityInvitation, CommunityResidentProfile, User]),
    AuthModule,
    EmailModule,
  ],
  providers: [CommunitiesService],
  controllers: [CommunitiesController],
  exports: [CommunitiesService],
})
export class CommunitiesModule {}
