import {
  Column,
  Entity,
  ManyToOne,
  JoinColumn,
  PrimaryGeneratedColumn,
  OneToMany,
} from "typeorm";
import { Project } from "../projects/project.entity";
import { User } from "../users/user.entity";
import { ProposalDepartment } from "./entities/proposal-department.entity";
import { ProposalSection } from "./entities/proposal-section.entity";
import { ProposalComment } from "./entities/proposal-comment.entity";

export enum ProposalStatus {
  PENDING = "pending",
  SOLICITUD_SUBMITTED = "solicitud_submitted",
  PROFORMA_READY = "proforma_ready",
  SIGNED = "signed",
  REJECTED = "rejected",
}

export enum ProposalType {
  PROJECT = "project",
  DIRECT_SALE = "direct_sale",
  SOLICITUD = "solicitud",
}

@Entity({ name: "proposals" })
export class Proposal {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "enum", enum: ProposalType, default: ProposalType.PROJECT })
  type!: ProposalType;

  @Column({ type: "uuid", nullable: true })
  projectId!: string | null;

  @ManyToOne(() => Project, { onDelete: "CASCADE", nullable: true })
  @JoinColumn({ name: "projectId" })
  project!: Project | null;

  @Column({ type: "uuid", nullable: true })
  clientId!: string | null;

  @ManyToOne(() => User, { onDelete: "RESTRICT", nullable: true })
  @JoinColumn({ name: "clientId" })
  client!: User | null;

  @Column({ type: "uuid", nullable: true })
  createdById!: string | null;

  @ManyToOne(() => User, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "createdById" })
  createdBy!: User | null;

  @Column({ type: "uuid", nullable: true })
  professionalId!: string | null;

  @ManyToOne(() => User, { onDelete: "CASCADE", nullable: true })
  @JoinColumn({ name: "professionalId" })
  professional!: User | null;

  @Column({ type: "numeric", precision: 12, scale: 2, default: 0 })
  laborCost!: number;

  @Column({ type: "text", nullable: true })
  message!: string | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  title!: string | null;

  @Column({ type: "numeric", precision: 5, scale: 2, nullable: true })
  taxRate!: number | null;

  @Column({ type: "enum", enum: ProposalStatus, default: ProposalStatus.PENDING })
  status!: ProposalStatus;

  @Column({ type: "uuid", nullable: true })
  orderId!: string | null;

  @OneToMany(() => ProposalDepartment, (dept) => dept.proposal, { cascade: true })
  proposalDepartments!: ProposalDepartment[];

  @OneToMany(() => ProposalSection, (section) => section.proposal, { cascade: true })
  sections!: ProposalSection[];

  @OneToMany(() => ProposalComment, (comment) => comment.proposal, { cascade: true })
  comments!: ProposalComment[];

  @Column({ type: "timestamp with time zone", default: () => "now()" })
  createdAt!: Date;
}
