import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Project } from "../project.entity";
import { ProjectDepartment } from "./project-department.entity";
import { User } from "../../users/user.entity";

@Entity("project_progress_entries")
export class ProjectProgressEntry {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "project_id" })
  projectId!: string;

  @ManyToOne(() => Project, { onDelete: "CASCADE" })
  @JoinColumn({ name: "project_id" })
  project!: Project;

  @Column({ name: "department_id", nullable: true })
  departmentId!: string | null;

  @ManyToOne(() => ProjectDepartment, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "department_id" })
  department!: ProjectDepartment | null;

  @Column({ type: "varchar", length: 255 })
  title!: string;

  @Column({ type: "text" })
  description!: string;

  @Column({ type: "int", nullable: true, name: "progress_percentage" })
  progressPercentage!: number | null;

  @Column({ name: "created_by_id" })
  createdById!: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "created_by_id" })
  createdBy!: User;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}
