import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Invoice } from "../invoices/entities/invoice.entity";
import { ClientOrder } from "../orders/entities/client-order.entity";
import { SupplierOrder } from "../supplier-orders/entities/supplier-order.entity";
import { SupplierInvoice } from "../supplier-orders/entities/supplier-invoice.entity";
import { Product } from "../products/product.entity";
import { ExportsService } from "./exports.service";
import { ExportsController } from "./exports.controller";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Invoice,
      ClientOrder,
      SupplierOrder,
      SupplierInvoice,
      Product,
    ]),
    AuthModule,
  ],
  controllers: [ExportsController],
  providers: [ExportsService],
})
export class ExportsModule {}
