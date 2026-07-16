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

  @Column({ type: "int" })
  quantityOrdered!: number;

  @Column({ type: "int", default: 0 })
  quantityFulfilled!: number;

  @Column({ type: "int", default: 0 })
  quantityInvoiced!: number;

  @Column({ type: "int", default: 0 })
  quantitySentToSupplier!: number;

  @Column({ type: "numeric", precision: 12, scale: 2 })
  unitPrice!: number;

  @Column({ type: "numeric", precision: 12, scale: 2 })
  lineTotal!: number;

  @Column({ type: "uuid", nullable: true })
  proposalMaterialListId!: string | null;

  @BeforeInsert()
  @BeforeUpdate()
  calculateLineTotal() {
    this.lineTotal = Number(this.unitPrice) * this.quantityOrdered;
  }
}
