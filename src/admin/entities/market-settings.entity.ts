import { Column, Entity, PrimaryColumn, UpdateDateColumn } from "typeorm";
import { MarketCode } from "../../common/market";

@Entity({ name: "market_settings" })
export class MarketSettings {
  @PrimaryColumn({ type: "enum", enum: MarketCode })
  code!: MarketCode;

  @Column({ type: "varchar", length: 100 })
  label!: string;

  @Column({ type: "varchar", length: 150 })
  storeName!: string;

  @Column({ type: "numeric", precision: 5, scale: 2 })
  taxRate!: number;

  @Column({ type: "varchar", length: 50 })
  taxLabel!: string;

  @Column({ type: "varchar", length: 10 })
  currency!: string;

  @Column({ type: "varchar", length: 20 })
  locale!: string;

  @Column({ type: "varchar", length: 50 })
  docLabel!: string;

  @Column({ type: "jsonb", default: [] })
  paymentMethods!: string[];

  @UpdateDateColumn({ type: "timestamp with time zone" })
  updatedAt!: Date;
}
