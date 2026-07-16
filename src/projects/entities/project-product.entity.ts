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

@Entity("project_products")
export class ProjectProduct {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "project_id" })
  projectId!: string;

  @ManyToOne(() => Project, { onDelete: "CASCADE" })
  @JoinColumn({ name: "project_id" })
  project!: Project;

  @Column({ name: "product_sku", type: "varchar", length: 100 })
  productSku!: string;

  @Column({ name: "product_name", type: "varchar", length: 255 })
  productName!: string;

  @Column({ type: "int", default: 1 })
  quantity!: number;

  @Column({ type: "text", nullable: true })
  notes!: string | null;

  @Column({ name: "added_by_id" })
  addedById!: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "added_by_id" })
  addedBy!: User;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}
