import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from "typeorm";
import { Project } from "../project.entity";
import { User } from "../../users/user.entity";

export enum ProjectMemberRole {
  OWNER = "owner",
  EDITOR = "editor",
  VIEWER = "viewer",
}

@Entity("project_members")
@Unique(["projectId", "userId"])
export class ProjectMember {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "project_id" })
  projectId!: string;

  @ManyToOne(() => Project, { onDelete: "CASCADE" })
  @JoinColumn({ name: "project_id" })
  project!: Project;

  @Column({ name: "user_id" })
  userId!: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: User;

  @Column({ type: "enum", enum: ProjectMemberRole, default: ProjectMemberRole.VIEWER })
  role!: ProjectMemberRole;

  @CreateDateColumn({ name: "joined_at" })
  joinedAt!: Date;
}
