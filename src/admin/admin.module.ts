import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { User } from "../users/user.entity";
import { Product } from "../products/product.entity";
import { Supplier } from "../suppliers/entities/supplier.entity";
import { Project } from "../projects/project.entity";
import { ClientOrderLineItem } from "../orders/entities/client-order-line-item.entity";
import { FactoryCode } from "../suppliers/entities/factory-code.entity";
import { AdminController } from "./admin.controller";
import { AuthModule } from "../auth/auth.module";
import { EmailModule } from "../email/email.module";
import { AdminInvitation } from "./entities/admin-invitation.entity";
import { MarketSettings } from "./entities/market-settings.entity";
import { MarketSettingsService } from "./market-settings.service";
import { DataMigrationService } from "./data-migration.service";
import { ProjectsModule } from "../projects/projects.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      AdminInvitation,
      MarketSettings,
      Product,
      Supplier,
      Project,
      ClientOrderLineItem,
      FactoryCode,
    ]),
    AuthModule,
    EmailModule,
    ProjectsModule,
  ],
  controllers: [AdminController],
  providers: [MarketSettingsService, DataMigrationService],
  exports: [MarketSettingsService],
})
export class AdminModule {}
