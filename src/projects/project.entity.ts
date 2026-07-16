import {
  Column,
  Entity,
  ManyToOne,
  JoinColumn,
  PrimaryGeneratedColumn,
  OneToMany,
} from "typeorm";
import { User } from "../users/user.entity";
import { ProjectDepartment } from "./entities/project-department.entity";

export enum ProjectStatus {
  OPEN = "open",
  REVIEWING = "reviewing",
  IN_PROGRESS = "in_progress",
  COMPLETED = "completed",
}

export enum ProjectType {
  RECONSTRUCTION = "reconstruction",
  RENOVATION = "renovation",
  NEW_BUILD = "new_build",
}

@Entity({ name: "projects" })
export class Project {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar", length: 255 })
  title!: string;

  @Column({ type: "text" })
  description!: string;

  @Column({ type: "uuid" })
  clientId!: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "clientId" })
  client!: User;

  @Column({ type: "boolean", default: true })
  isPublic!: boolean;

  @Column({ type: "enum", enum: ProjectStatus, default: ProjectStatus.OPEN })
  status!: ProjectStatus;

  @Column({ type: "enum", enum: ProjectType, default: ProjectType.RECONSTRUCTION })
  projectType!: ProjectType;

  @Column({ type: "varchar", length: 255, nullable: true })
  locality!: string | null;

  @Column({ type: "boolean", default: false })
  isDetailed!: boolean;

  @Column({ type: "numeric", precision: 12, scale: 2, nullable: true })
  budget!: number | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  location!: string | null;

  @Column({ type: "varchar", length: 100, nullable: true })
  state!: string | null;

  @Column({ type: "varchar", length: 20, nullable: true, name: "postal_code" })
  postalCode!: string | null;

  @Column({ type: "varchar", length: 3, default: "VE" })
  country!: string;

  @Column({ type: "text", array: true, default: [] })
  images!: string[];

  @OneToMany(() => ProjectDepartment, (dept) => dept.project, { cascade: true })
  departments!: ProjectDepartment[];

  @Column({ type: "timestamp with time zone", default: () => "now()" })
  createdAt!: Date;
}
