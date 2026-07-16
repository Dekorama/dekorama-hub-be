import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Supplier } from "./supplier.entity";
import { Product } from "../../products/product.entity";

@Entity({ name: "factory_codes" })
export class FactoryCode {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  supplierId!: string;

  @ManyToOne(() => Supplier, (s) => s.factoryCodes, { onDelete: "CASCADE" })
  @JoinColumn({ name: "supplierId" })
  supplier!: Supplier;

  @Column({ type: "varchar", length: 100 })
  productSku!: string;

  @ManyToOne(() => Product, { onDelete: "CASCADE" })
  @JoinColumn({ name: "productSku", referencedColumnName: "sku" })
  product!: Product;

  @Column({ type: "varchar", length: 100 })
  factoryCode!: string;

  @Column({ type: "numeric", precision: 12, scale: 2, nullable: true })
  factoryCost!: number | null;

  @Column({ type: "boolean", default: false })
  isPrimary!: boolean;

  @Column({ type: "timestamp with time zone", default: () => "now()" })
  createdAt!: Date;
}
