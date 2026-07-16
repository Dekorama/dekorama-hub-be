import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Proposal } from "../proposal.entity";
import { MaterialList } from "../../material-lists/material-list.entity";

@Entity({ name: "proposal_sections" })
export class ProposalSection {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  proposalId!: string;

  @ManyToOne(() => Proposal, (p) => p.sections, { onDelete: "CASCADE" })
  @JoinColumn({ name: "proposalId" })
  proposal!: Proposal;

  @Column({ type: "varchar", length: 255 })
  name!: string;

  @Column({ type: "int", default: 0 })
  sortOrder!: number;

  @OneToMany(() => MaterialList, (m) => m.section)
  materials!: MaterialList[];
}
