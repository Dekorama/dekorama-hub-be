import {
  Column,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { MarketCode } from "../../common/market";
import { FactoryCode } from "./factory-code.entity";
import { SupplierFamily } from "./supplier-family.entity";

@Entity({ name: "suppliers" })
export class Supplier {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "enum", enum: MarketCode, default: MarketCode.VE })
  market!: MarketCode;

  /** 3-letter business prefix used in product SKUs: {prefix}-{#####} */
  @Column({ type: "varchar", length: 3, unique: true, nullable: true })
  prefix!: string | null;

  @Column({ type: "varchar", length: 255 })
  name!: string;

  /** particular | empresa — drives which fiscal document types apply. */
  @Column({ type: "varchar", length: 20, nullable: true })
  legalType!: string | null;

  /** dni | nie | nif | cif | cedula | rif */
  @Column({ type: "varchar", length: 20, nullable: true })
  documentType!: string | null;

  @Column({ type: "varchar", length: 50, nullable: true })
  documentNumber!: string | null;

  @Column({ type: "varchar", length: 255 })
  email!: string;

  /** Extra emails beyond the primary `email`. */
  @Column({ type: "jsonb", default: [] })
  emails!: string[];

  @Column({ type: "varchar", length: 50, nullable: true })
  phone!: string | null;

  /** Extra phones beyond the primary `phone`. */
  @Column({ type: "jsonb", default: [] })
  phones!: string[];

  @Column({ type: "text", nullable: true })
  address!: string | null;

  @Column({ type: "text", nullable: true })
  notes!: string | null;

  @Column({ type: "varchar", length: 100, nullable: true })
  accountNumber!: string | null;

  @Column({ type: "numeric", precision: 5, scale: 2, nullable: true })
  taxRate!: number | null;

  @Column({ type: "boolean", default: false })
  taxExempt!: boolean;

  @Column({ type: "boolean", default: true })
  isActive!: boolean;

  @OneToMany(() => FactoryCode, (fc) => fc.supplier)
  factoryCodes!: FactoryCode[];

  @OneToMany(() => SupplierFamily, (sf) => sf.supplier)
  familyLinks!: SupplierFamily[];

  @Column({ type: "timestamp with time zone", default: () => "now()" })
  createdAt!: Date;
}
