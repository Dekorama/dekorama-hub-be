import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Supplier } from "../../suppliers/entities/supplier.entity";
import { ClientOrder } from "../../orders/entities/client-order.entity";
import { SupplierOrderLineItem } from "./supplier-order-line-item.entity";
import { SupplierInvoice } from "./supplier-invoice.entity";

export enum SupplierOrderStatus {
  DRAFT = "draft",
  SENT = "sent",
  CONFIRMED = "confirmed",
  RECEIVED = "received",
  CANCELLED = "cancelled",
}

@Entity({ name: "supplier_orders" })
export class SupplierOrder {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar", length: 50, unique: true })
  orderNumber!: string;

  @Column({ type: "uuid" })
  supplierId!: string;

  @ManyToOne(() => Supplier, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "supplierId" })
  supplier!: Supplier;

  @Column({ type: "uuid" })
  clientOrderId!: string;

  @ManyToOne(() => ClientOrder, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "clientOrderId" })
  clientOrder!: ClientOrder;

  @Column({ type: "enum", enum: SupplierOrderStatus, default: SupplierOrderStatus.DRAFT })
  status!: SupplierOrderStatus;

  @Column({ type: "timestamp with time zone", nullable: true })
  sentAt!: Date | null;

  @Column({ type: "text", nullable: true })
  notes!: string | null;

  @OneToMany(() => SupplierOrderLineItem, (i) => i.supplierOrder, { cascade: true, eager: true })
  lineItems!: SupplierOrderLineItem[];

  @OneToMany(() => SupplierInvoice, (i) => i.supplierOrder)
  invoices!: SupplierInvoice[];

  @Column({ type: "timestamp with time zone", default: () => "now()" })
  createdAt!: Date;
}
