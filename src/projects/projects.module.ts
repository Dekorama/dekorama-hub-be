import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Project } from "./project.entity";
import { ProjectDepartment } from "./entities/project-department.entity";
import { ProjectProgressEntry } from "./entities/project-progress-entry.entity";
import { ProjectNote } from "./entities/project-note.entity";
import { ProjectProduct } from "./entities/project-product.entity";
import { ProjectMember } from "./entities/project-member.entity";
import { ProjectInvitation } from "./entities/project-invitation.entity";
import { User } from "../users/user.entity";
import { Product } from "../products/product.entity";
import { ProjectsService } from "./projects.service";
import { ProjectsController } from "./projects.controller";
import { AuthModule } from "../auth/auth.module";
import { EmailModule } from "../email/email.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Project,
      ProjectDepartment,
      ProjectProgressEntry,
      ProjectNote,
      ProjectProduct,
      ProjectMember,
      ProjectInvitation,
      User,
      Product,
    ]),
    AuthModule,
    EmailModule,
  ],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
