import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { SupplierOrder } from "./supplier-order.entity";
import { Supplier } from "../../suppliers/entities/supplier.entity";

export enum SupplierInvoiceStatus {
  PENDING = "pending",
  MATCHED = "matched",
  PAID = "paid",
}

@Entity({ name: "supplier_invoices" })
export class SupplierInvoice {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  supplierOrderId!: string;

  @ManyToOne(() => SupplierOrder, (o) => o.invoices, { onDelete: "CASCADE" })
  @JoinColumn({ name: "supplierOrderId" })
  supplierOrder!: SupplierOrder;

  @Column({ type: "uuid" })
  supplierId!: string;

  @ManyToOne(() => Supplier, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "supplierId" })
  supplier!: Supplier;

  @Column({ type: "varchar", length: 100 })
  invoiceNumber!: string;

  @Column({ type: "date" })
  issueDate!: Date;

  @Column({ type: "numeric", precision: 12, scale: 2 })
  amount!: number;

  @Column({ type: "varchar", length: 500, nullable: true })
  fileUrl!: string | null;

  @Column({ type: "enum", enum: SupplierInvoiceStatus, default: SupplierInvoiceStatus.PENDING })
  status!: SupplierInvoiceStatus;

  @Column({ type: "text", nullable: true })
  notes!: string | null;

  @Column({ type: "timestamp with time zone", default: () => "now()" })
  createdAt!: Date;
}
