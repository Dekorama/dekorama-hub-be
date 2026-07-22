import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Invoice } from "./entities/invoice.entity";
import { InvoiceLineItem } from "./entities/invoice-line-item.entity";
import { Proposal } from "../proposals/proposal.entity";
import { User } from "../users/user.entity";
import { MaterialList } from "../material-lists/material-list.entity";
import { ClientOrder } from "../orders/entities/client-order.entity";
import { ClientOrderLineItem } from "../orders/entities/client-order-line-item.entity";
import { InvoicesService } from "./invoices.service";
import { InvoicesController } from "./invoices.controller";
import { AuthModule } from "../auth/auth.module";
import { AdminModule } from "../admin/admin.module";
import { GcsModule } from "../gcs/gcs.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Invoice,
      InvoiceLineItem,
      Proposal,
      User,
      MaterialList,
      ClientOrder,
      ClientOrderLineItem,
    ]),
    AuthModule,
    AdminModule,
    GcsModule,
  ],
  controllers: [InvoicesController],
  providers: [InvoicesService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
