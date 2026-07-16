import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { User } from "../users/user.entity";

export enum DocumentType {
  RIF = "rif",
  PROFESSIONAL_LICENSE = "professional_license",
  ASSOCIATION_CERTIFICATE = "association_certificate",
}

export enum DocumentStatus {
  PENDING = "pending",
  APPROVED = "approved",
  REJECTED = "rejected",
}

@Entity("professional_documents")
export class ProfessionalDocument {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  userId!: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user!: User;

  @Column({ type: "enum", enum: DocumentType })
  documentType!: DocumentType;

  @Column({ type: "text" })
  fileUrl!: string;

  @Column({ type: "enum", enum: DocumentStatus, default: DocumentStatus.PENDING })
  status!: DocumentStatus;

  @Column({ type: "text", nullable: true })
  rejectionReason!: string | null;

  @Column({ type: "timestamp with time zone", default: () => "now()" })
  createdAt!: Date;

  @Column({ type: "timestamp with time zone", default: () => "now()" })
  updatedAt!: Date;
}
