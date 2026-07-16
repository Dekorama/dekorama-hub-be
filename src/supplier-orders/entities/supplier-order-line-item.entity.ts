import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  BeforeInsert,
  BeforeUpdate,
} from "typeorm";
import { SupplierOrder } from "./supplier-order.entity";
import { Product } from "../../products/product.entity";

@Entity({ name: "supplier_order_line_items" })
export class SupplierOrderLineItem {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  supplierOrderId!: string;

  @ManyToOne(() => SupplierOrder, (o) => o.lineItems, { onDelete: "CASCADE" })
  @JoinColumn({ name: "supplierOrderId" })
  supplierOrder!: SupplierOrder;

  @Column({ type: "uuid", nullable: true })
  clientOrderLineItemId!: string | null;

  @Column({ type: "varchar", length: 100 })
  productSku!: string;

  @ManyToOne(() => Product, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "productSku", referencedColumnName: "sku" })
  product!: Product;

  @Column({ type: "varchar", length: 100 })
  factoryCode!: string;

  @Column({ type: "int" })
  quantity!: number;

  @Column({ type: "numeric", precision: 12, scale: 2 })
  unitCost!: number;

  @Column({ type: "numeric", precision: 12, scale: 2 })
  lineTotal!: number;

  @BeforeInsert()
  @BeforeUpdate()
  calculateLineTotal() {
    this.lineTotal = Number(this.unitCost) * this.quantity;
  }
}
