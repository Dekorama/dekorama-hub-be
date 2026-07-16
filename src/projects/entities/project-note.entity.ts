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

@Entity("project_notes")
export class ProjectNote {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "project_id" })
  projectId!: string;

  @ManyToOne(() => Project, { onDelete: "CASCADE" })
  @JoinColumn({ name: "project_id" })
  project!: Project;

  @Column({ name: "author_id" })
  authorId!: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "author_id" })
  author!: User;

  @Column({ type: "text" })
  content!: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}
