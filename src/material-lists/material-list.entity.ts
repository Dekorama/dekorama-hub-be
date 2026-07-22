import {
  Column,
  Entity,
  ManyToOne,
  JoinColumn,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Proposal } from "../proposals/proposal.entity";
import { ProposalSection } from "../proposals/entities/proposal-section.entity";

@Entity({ name: "material_lists" })
export class MaterialList {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  proposalId!: string;

  @ManyToOne(() => Proposal, { onDelete: "CASCADE" })
  @JoinColumn({ name: "proposalId" })
  proposal!: Proposal;

  @Column({ type: "uuid", nullable: true })
  sectionId!: string | null;

  @ManyToOne(() => ProposalSection, (s) => s.materials, {
    onDelete: "SET NULL",
    nullable: true,
  })
  @JoinColumn({ name: "sectionId" })
  section!: ProposalSection | null;

  @Column({ type: "varchar", length: 100 })
  productSku!: string;

  @Column({ type: "varchar", length: 255 })
  productName!: string;

  /** Snapshot of product.unit at time of adding */
  @Column({ type: "varchar", length: 50, default: "unidad" })
  unit!: string;

  @Column({ type: "numeric", precision: 12, scale: 4 })
  quantity!: number;

  /** Quantity already converted into client orders */
  @Column({ type: "numeric", precision: 12, scale: 4, default: 0 })
  orderedQuantity!: number;

  /** Per-line discount percentage (0–100) */
  @Column({ type: "numeric", precision: 5, scale: 2, default: 0 })
  discountPct!: number;

  // Snapshot of price at time of adding, preserved even if Product.price changes later
  @Column({ type: "numeric", precision: 12, scale: 2 })
  suggestedPrice!: number;
}
