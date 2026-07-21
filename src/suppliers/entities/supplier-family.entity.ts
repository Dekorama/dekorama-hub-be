import { Entity, ManyToOne, JoinColumn, PrimaryColumn } from "typeorm";
import { Supplier } from "./supplier.entity";
import { ProductFamily } from "../../products/entities/product-family.entity";

@Entity({ name: "supplier_families" })
export class SupplierFamily {
  @PrimaryColumn({ type: "uuid" })
  supplierId!: string;

  @PrimaryColumn({ type: "varchar", length: 3 })
  familyCode!: string;

  @ManyToOne(() => Supplier, (s) => s.familyLinks, { onDelete: "CASCADE" })
  @JoinColumn({ name: "supplierId" })
  supplier!: Supplier;

  @ManyToOne(() => ProductFamily, { onDelete: "CASCADE" })
  @JoinColumn({ name: "familyCode" })
  family!: ProductFamily;
}
