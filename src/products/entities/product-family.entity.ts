import { Entity, PrimaryColumn, Column, OneToMany } from "typeorm";
import { ProductSubfamily } from "./product-subfamily.entity";

@Entity("product_families")
export class ProductFamily {
  @PrimaryColumn({ type: "varchar", length: 3 })
  code!: string;

  @Column({ type: "varchar", length: 100 })
  name!: string;

  @Column({ type: "text", nullable: true })
  description!: string | null;

  @Column({ type: "varchar", length: 100, nullable: true })
  icon!: string | null;

  @OneToMany(() => ProductSubfamily, (subfamily) => subfamily.family)
  subfamilies!: ProductSubfamily[];

  @Column({ type: "timestamp with time zone", default: () => "now()" })
  createdAt!: Date;

  @Column({ type: "timestamp with time zone", default: () => "now()" })
  updatedAt!: Date;
}
