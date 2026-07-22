import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ClientOrder } from "./entities/client-order.entity";
import { ClientOrderLineItem } from "./entities/client-order-line-item.entity";
import { ClientOrderSection } from "./entities/client-order-section.entity";
import { Proposal } from "../proposals/proposal.entity";
import { MaterialList } from "../material-lists/material-list.entity";
import { Product } from "../products/product.entity";
import { User } from "../users/user.entity";
import { OrdersService } from "./orders.service";
import { OrdersController } from "./orders.controller";
import { AuthModule } from "../auth/auth.module";
import { AdminModule } from "../admin/admin.module";
import { SupplierOrdersModule } from "../supplier-orders/supplier-orders.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ClientOrder,
      ClientOrderLineItem,
      ClientOrderSection,
      Proposal,
      MaterialList,
      Product,
      User,
    ]),
    AuthModule,
    AdminModule,
    SupplierOrdersModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
