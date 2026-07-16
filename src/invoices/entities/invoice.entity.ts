import {
  Column,
  Entity,
  ManyToOne,
  OneToMany,
  JoinColumn,
  PrimaryGeneratedColumn,
  BeforeInsert,
  BeforeUpdate,
} from "typeorm";
import { User } from "../../users/user.entity";
import { Proposal } from "../../proposals/proposal.entity";
import { InvoiceLineItem } from "./invoice-line-item.entity";

export enum InvoiceStatus {
  DRAFT = "draft",
  ISSUED = "issued",
  PAID = "paid",
  CANCELLED = "cancelled",
}

@Entity({ name: "invoices" })
export class Invoice {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar", length: 50, unique: true })
  invoiceNumber!: string;

  @Column({ type: "uuid", nullable: true })
  proposalId!: string | null;

  @ManyToOne(() => Proposal, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "proposalId" })
  proposal!: Proposal | null;

  @Column({ type: "uuid", nullable: true })
  orderId!: string | null;

  @Column({ type: "uuid" })
  clientId!: string;

  @ManyToOne(() => User, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "clientId" })
  client!: User;

  @Column({ type: "date" })
  issueDate!: Date;

  @Column({ type: "date", nullable: true })
  dueDate!: Date | null;

  @Column({ type: "numeric", precision: 12, scale: 2, default: 0 })
  subtotal!: number;

  @Column({ type: "numeric", precision: 5, scale: 2, default: 0 })
  taxRate!: number;

  @Column({ type: "numeric", precision: 12, scale: 2, default: 0 })
  taxAmount!: number;

  @Column({ type: "numeric", precision: 12, scale: 2, default: 0 })
  total!: number;

  @Column({ type: "enum", enum: InvoiceStatus, default: InvoiceStatus.DRAFT })
  status!: InvoiceStatus;

  @Column({ type: "text", nullable: true })
  notes!: string | null;

  @Column({ type: "uuid" })
  createdBy!: string;

  @ManyToOne(() => User, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "createdBy" })
  creator!: User;

  @OneToMany(() => InvoiceLineItem, (item) => item.invoice, { cascade: true, eager: true })
  lineItems!: InvoiceLineItem[];

  @Column({ type: "timestamp with time zone", default: () => "now()" })
  createdAt!: Date;

  @Column({ type: "timestamp with time zone", default: () => "now()" })
  updatedAt!: Date;

  @BeforeInsert()
  @BeforeUpdate()
  calculateTotals() {
    if (this.lineItems && this.lineItems.length > 0) {
      // Sum all line items to get subtotal
      this.subtotal = this.lineItems.reduce(
        (sum, item) => sum + Number(item.lineTotal || 0),
        0
      );
    } else {
      this.subtotal = 0;
    }

    // Calculate tax amount
    this.taxAmount = this.subtotal * (Number(this.taxRate) / 100);

    // Calculate total
    this.total = this.subtotal + this.taxAmount;
  }

  @BeforeUpdate()
  updateTimestamp() {
    this.updatedAt = new Date();
  }
}
