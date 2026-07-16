import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Invoice } from "../invoices/entities/invoice.entity";
import { ClientOrder } from "../orders/entities/client-order.entity";
import { Proposal } from "../proposals/proposal.entity";
import { SupplierOrder } from "../supplier-orders/entities/supplier-order.entity";
import { ClientOrderLineItem } from "../orders/entities/client-order-line-item.entity";
import { User } from "../users/user.entity";
import { Project } from "../projects/project.entity";
import { Product } from "../products/product.entity";
import { Supplier } from "../suppliers/entities/supplier.entity";
import { ReportsService } from "./reports.service";
import { ReportsController } from "./reports.controller";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Invoice,
      ClientOrder,
      Proposal,
      SupplierOrder,
      ClientOrderLineItem,
      User,
      Project,
      Product,
      Supplier,
    ]),
    AuthModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
