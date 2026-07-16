import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Proposal } from "./proposal.entity";
import { ProposalDepartment } from "./entities/proposal-department.entity";
import { ProposalSection } from "./entities/proposal-section.entity";
import { ProposalComment } from "./entities/proposal-comment.entity";
import { Project } from "../projects/project.entity";
import { ProjectDepartment } from "../projects/entities/project-department.entity";
import { MaterialList } from "../material-lists/material-list.entity";
import { Product } from "../products/product.entity";
import { User } from "../users/user.entity";
import { ProposalsService } from "./proposals.service";
import { ProposalsController } from "./proposals.controller";
import { AuthModule } from "../auth/auth.module";
import { EmailModule } from "../email/email.module";
import { ProjectsModule } from "../projects/projects.module";
import { AdminModule } from "../admin/admin.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Proposal,
      ProposalDepartment,
      ProposalSection,
      ProposalComment,
      Project,
      ProjectDepartment,
      MaterialList,
      Product,
      User,
    ]),
    AuthModule,
    EmailModule,
    ProjectsModule,
    AdminModule,
  ],
  controllers: [ProposalsController],
  providers: [ProposalsService],
  exports: [ProposalsService],
})
export class ProposalsModule {}
