import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SupplierOrder } from "./entities/supplier-order.entity";
import { SupplierOrderLineItem } from "./entities/supplier-order-line-item.entity";
import { SupplierInvoice } from "./entities/supplier-invoice.entity";
import { ClientOrder } from "../orders/entities/client-order.entity";
import { ClientOrderLineItem } from "../orders/entities/client-order-line-item.entity";
import { Supplier } from "../suppliers/entities/supplier.entity";
import { FactoryCode } from "../suppliers/entities/factory-code.entity";
import { SupplierOrdersService } from "./supplier-orders.service";
import { SupplierOrdersController } from "./supplier-orders.controller";
import { AuthModule } from "../auth/auth.module";
import { EmailModule } from "../email/email.module";
import { AdminModule } from "../admin/admin.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SupplierOrder,
      SupplierOrderLineItem,
      SupplierInvoice,
      ClientOrder,
      ClientOrderLineItem,
      Supplier,
      FactoryCode,
    ]),
    AuthModule,
    EmailModule,
    AdminModule,
  ],
  controllers: [SupplierOrdersController],
  providers: [SupplierOrdersService],
  exports: [SupplierOrdersService],
})
export class SupplierOrdersModule {}
