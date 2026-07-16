import {
  Entity,
  PrimaryColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { ProductFamily } from "./product-family.entity";
import { Supplier } from "../../suppliers/entities/supplier.entity";

@Entity("product_subfamilies")
export class ProductSubfamily {
  @PrimaryColumn({ type: "varchar", length: 3 })
  code!: string;

  @Column({ type: "varchar", length: 3 })
  familyCode!: string;

  @ManyToOne(() => ProductFamily, (family) => family.subfamilies, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "familyCode" })
  family!: ProductFamily;

  @Index()
  @Column({ type: "uuid", nullable: true })
  supplierId!: string | null;

  @ManyToOne(() => Supplier, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "supplierId" })
  supplier!: Supplier | null;

  @Column({ type: "varchar", length: 100 })
  name!: string;

  @Column({ type: "text", nullable: true })
  description!: string | null;

  @Column({ type: "timestamp with time zone", default: () => "now()" })
  createdAt!: Date;

  @Column({ type: "timestamp with time zone", default: () => "now()" })
  updatedAt!: Date;
}
