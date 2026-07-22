import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  BeforeInsert,
  BeforeUpdate,
} from "typeorm";
import { User } from "../../users/user.entity";
import { Proposal } from "../../proposals/proposal.entity";
import { ClientOrderLineItem } from "./client-order-line-item.entity";
import { ClientOrderSection } from "./client-order-section.entity";

export enum ClientOrderStatus {
  DRAFT = "draft",
  CONFIRMED = "confirmed",
  PARTIAL = "partial",
  FULFILLED = "fulfilled",
  CANCELLED = "cancelled",
}

@Entity({ name: "client_orders" })
export class ClientOrder {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar", length: 50, unique: true })
  orderNumber!: string;

  @Column({ type: "uuid" })
  proposalId!: string;

  @ManyToOne(() => Proposal, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "proposalId" })
  proposal!: Proposal;

  @Column({ type: "uuid" })
  clientId!: string;

  @ManyToOne(() => User, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "clientId" })
  client!: User;

  @Column({ type: "enum", enum: ClientOrderStatus, default: ClientOrderStatus.DRAFT })
  status!: ClientOrderStatus;

  @Column({ type: "numeric", precision: 12, scale: 2, default: 0 })
  subtotal!: number;

  @Column({ type: "numeric", precision: 5, scale: 2, default: 16 })
  taxRate!: number;

  @Column({ type: "numeric", precision: 12, scale: 2, default: 0 })
  taxAmount!: number;

  @Column({ type: "numeric", precision: 12, scale: 2, default: 0 })
  total!: number;

  @Column({ type: "uuid" })
  createdBy!: string;

  @ManyToOne(() => User, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "createdBy" })
  creator!: User;

  @Column({ type: "text", nullable: true })
  externalNotes!: string | null;

  @Column({ type: "text", nullable: true })
  internalNotes!: string | null;

  @OneToMany(() => ClientOrderLineItem, (item) => item.order, { cascade: true, eager: true })
  lineItems!: ClientOrderLineItem[];

  @OneToMany(() => ClientOrderSection, (s) => s.order, { cascade: true })
  sections!: ClientOrderSection[];

  @Column({ type: "timestamp with time zone", default: () => "now()" })
  createdAt!: Date;

  recalculateTotals(): void {
    if (this.lineItems?.length) {
      this.subtotal = this.lineItems.reduce((sum, item) => {
        const discount = Number(item.discountPct) || 0;
        return (
          sum +
          Number(item.unitPrice) *
            Number(item.quantityOrdered) *
            (1 - discount / 100)
        );
      }, 0);
    } else {
      this.subtotal = 0;
    }
    this.taxAmount = this.subtotal * (Number(this.taxRate) / 100);
    this.total = this.subtotal + this.taxAmount;
  }

  @BeforeInsert()
  @BeforeUpdate()
  calculateTotals() {
    this.recalculateTotals();
  }
}
