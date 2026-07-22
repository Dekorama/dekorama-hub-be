import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  BeforeInsert,
  BeforeUpdate,
} from "typeorm";
import { ProductFamily } from "./entities/product-family.entity";
import { ProductSubfamily } from "./entities/product-subfamily.entity";
import { MarketCode } from "../common/market";

export enum PricingMode {
  NETO = "neto",
  PVP = "pvp",
}

export enum FinishType {
  DECORADO = "decorado",
  PIEZA_LISA = "pieza_lisa",
}

@Entity({ name: "products" })
export class Product {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar", length: 100, unique: true })
  sku!: string;

  @Column({ type: "varchar", length: 255 })
  name!: string;

  @Column({ type: "varchar", length: 3 })
  family!: string;

  @Column({ type: "varchar", length: 100 })
  familyName!: string;

  @ManyToOne(() => ProductFamily, { eager: false })
  @JoinColumn({ name: "family" })
  familyRelation!: ProductFamily;

  @Column({ type: "varchar", length: 3 })
  subfamily!: string;

  @Column({ type: "varchar", length: 100 })
  subfamilyName!: string;

  @ManyToOne(() => ProductSubfamily, { eager: false })
  @JoinColumn({ name: "subfamily" })
  subfamilyRelation!: ProductSubfamily;

  @Column({ type: "varchar", length: 10, default: PricingMode.NETO })
  pricingMode!: PricingMode;

  @Column({ type: "varchar", length: 20, nullable: true })
  finishType!: FinishType | null;

  @Column({ type: "numeric", precision: 12, scale: 2 })
  factoryCost!: number;

  @Column({ type: "numeric", precision: 5, scale: 2 })
  profitMargin!: number;

  @Column({ type: "numeric", precision: 12, scale: 2 })
  pvpPrice!: number;

  @Column({ type: "varchar", length: 50, default: "unidad" })
  unit!: string;

  /** Piezas por caja — required when unit is m2. */
  @Column({ type: "int", nullable: true })
  piecesPerBox!: number | null;

  /** Cobertura total de la caja en la unidad del producto (ej. m²/caja). Column name legacy. */
  @Column({ type: "numeric", precision: 12, scale: 4, nullable: true })
  unitPerPiece!: number | null;

  @Column({ type: "int", default: 0 })
  stock!: number;

  @Column({ type: "text", nullable: true })
  description!: string | null;

  @Column({ type: "varchar", length: 500, nullable: true })
  imageUrl!: string | null;

  @Column({ type: "boolean", default: true })
  isActive!: boolean;

  @Column({ type: "varchar", length: 2, default: MarketCode.VE })
  market!: MarketCode;

  @Column({ type: "timestamp with time zone", default: () => "now()" })
  createdAt!: Date;

  @Column({ type: "timestamp with time zone", default: () => "now()" })
  updatedAt!: Date;

  @BeforeInsert()
  @BeforeUpdate()
  calculatePVP() {
    const margin = Number(this.profitMargin);
    if (this.pricingMode === PricingMode.PVP) {
      if (
        this.pvpPrice !== undefined &&
        this.pvpPrice !== null &&
        this.profitMargin !== undefined &&
        this.profitMargin !== null
      ) {
        this.factoryCost =
          Math.round((Number(this.pvpPrice) / (1 + margin / 100)) * 100) / 100;
      }
      return;
    }
    if (
      this.factoryCost !== undefined &&
      this.factoryCost !== null &&
      this.profitMargin !== undefined
    ) {
      this.pvpPrice = Number(this.factoryCost) * (1 + margin / 100);
    }
  }

  @BeforeUpdate()
  updateTimestamp() {
    this.updatedAt = new Date();
  }
}
