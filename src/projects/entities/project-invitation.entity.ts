import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Project } from "../project.entity";
import { User } from "../../users/user.entity";
import { ProjectMemberRole } from "./project-member.entity";

export enum ProjectInvitationStatus {
  PENDING = "pending",
  ACCEPTED = "accepted",
  EXPIRED = "expired",
}

@Entity("project_invitations")
export class ProjectInvitation {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "project_id" })
  projectId!: string;

  @ManyToOne(() => Project, { onDelete: "CASCADE" })
  @JoinColumn({ name: "project_id" })
  project!: Project;

  @Column({ name: "invitee_email", type: "varchar", length: 150 })
  inviteeEmail!: string;

  @Column({ type: "varchar", length: 512 })
  token!: string;

  @Column({ name: "invited_by_id" })
  invitedById!: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "invited_by_id" })
  invitedBy!: User;

  @Column({ type: "enum", enum: ProjectMemberRole, default: ProjectMemberRole.VIEWER })
  role!: ProjectMemberRole;

  @Column({
    type: "enum",
    enum: ProjectInvitationStatus,
    default: ProjectInvitationStatus.PENDING,
  })
  status!: ProjectInvitationStatus;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}
