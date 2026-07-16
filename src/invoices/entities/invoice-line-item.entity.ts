import {
  Column,
  Entity,
  ManyToOne,
  JoinColumn,
  PrimaryGeneratedColumn,
  BeforeInsert,
  BeforeUpdate,
} from "typeorm";
import { Invoice } from "./invoice.entity";

@Entity({ name: "invoice_line_items" })
export class InvoiceLineItem {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  invoiceId!: string;

  @ManyToOne(() => Invoice, (invoice) => invoice.lineItems, { onDelete: "CASCADE" })
  @JoinColumn({ name: "invoiceId" })
  invoice!: Invoice;

  @Column({ type: "varchar", length: 500 })
  description!: string;

  @Column({ type: "varchar", length: 100, nullable: true })
  productSku!: string | null;

  @Column({ type: "uuid", nullable: true })
  orderLineItemId!: string | null;

  @Column({ type: "int" })
  quantity!: number;

  @Column({ type: "numeric", precision: 12, scale: 2 })
  unitPrice!: number;

  @Column({ type: "numeric", precision: 12, scale: 2 })
  lineTotal!: number;

  @Column({ type: "timestamp with time zone", default: () => "now()" })
  createdAt!: Date;

  @Column({ type: "timestamp with time zone", default: () => "now()" })
  updatedAt!: Date;

  @BeforeInsert()
  @BeforeUpdate()
  calculateLineTotal() {
    this.lineTotal = Number(this.quantity) * Number(this.unitPrice);
  }

  @BeforeUpdate()
  updateTimestamp() {
    this.updatedAt = new Date();
  }
}
