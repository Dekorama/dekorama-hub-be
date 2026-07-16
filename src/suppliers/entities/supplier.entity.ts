import {
  Column,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { MarketCode } from "../../common/market";
import { FactoryCode } from "./factory-code.entity";

@Entity({ name: "suppliers" })
export class Supplier {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "enum", enum: MarketCode, default: MarketCode.VE })
  market!: MarketCode;

  @Column({ type: "varchar", length: 255 })
  name!: string;

  @Column({ type: "varchar", length: 255 })
  email!: string;

  @Column({ type: "varchar", length: 50, nullable: true })
  phone!: string | null;

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

  @Column({ type: "timestamp with time zone", default: () => "now()" })
  createdAt!: Date;
}
