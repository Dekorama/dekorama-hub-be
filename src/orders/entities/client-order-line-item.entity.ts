import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  BeforeInsert,
  BeforeUpdate,
} from "typeorm";
import { ClientOrder } from "./client-order.entity";
import { Product } from "../../products/product.entity";

@Entity({ name: "client_order_line_items" })
export class ClientOrderLineItem {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  orderId!: string;

  @ManyToOne(() => ClientOrder, (o) => o.lineItems, { onDelete: "CASCADE" })
  @JoinColumn({ name: "orderId" })
  order!: ClientOrder;

  @Column({ type: "varchar", length: 100 })
  productSku!: string;

  @ManyToOne(() => Product, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "productSku", referencedColumnName: "sku" })
  product!: Product;

  /** Snapshot of product.unit */
  @Column({ type: "varchar", length: 50, default: "unidad" })
  unit!: string;

  @Column({ type: "numeric", precision: 12, scale: 4 })
  quantityOrdered!: number;

  @Column({ type: "numeric", precision: 12, scale: 4, default: 0 })
  quantityFulfilled!: number;

  @Column({ type: "numeric", precision: 12, scale: 4, default: 0 })
  quantityInvoiced!: number;

  @Column({ type: "numeric", precision: 12, scale: 4, default: 0 })
  quantitySentToSupplier!: number;

  @Column({ type: "numeric", precision: 12, scale: 2 })
  unitPrice!: number;

  /** Per-line discount percentage (0–100) */
  @Column({ type: "numeric", precision: 5, scale: 2, default: 0 })
  discountPct!: number;

  @Column({ type: "numeric", precision: 12, scale: 2 })
  lineTotal!: number;

  @Column({ type: "uuid", nullable: true })
  proposalMaterialListId!: string | null;

  @BeforeInsert()
  @BeforeUpdate()
  calculateLineTotal() {
    const discount = Number(this.discountPct) || 0;
    this.lineTotal =
      Number(this.unitPrice) *
      Number(this.quantityOrdered) *
      (1 - discount / 100);
  }
}
