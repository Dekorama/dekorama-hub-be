import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ProfessionalDocument } from "./professional-document.entity";
import { User } from "../users/user.entity";
import { PortfolioProject } from "./entities/portfolio-project.entity";
import { ProductTag } from "./entities/product-tag.entity";
import { Product } from "../products/product.entity";
import { ProfessionalDocumentsService } from "./professional-documents.service";
import { ProfessionalDocumentsController } from "./professional-documents.controller";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProfessionalDocument,
      User,
      PortfolioProject,
      ProductTag,
      Product,
    ]),
    AuthModule,
  ],
  controllers: [ProfessionalDocumentsController],
  providers: [ProfessionalDocumentsService],
  exports: [ProfessionalDocumentsService],
})
export class ProfessionalDocumentsModule {}
