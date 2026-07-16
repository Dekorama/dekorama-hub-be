import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from "typeorm";
import { User } from "../../users/user.entity";
import { ProductTag } from "./product-tag.entity";

@Entity("portfolio_projects")
export class PortfolioProject {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  professionalId!: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "professionalId" })
  professional!: User;

  @Column({ type: "varchar", length: 200 })
  title!: string;

  @Column({ type: "text", nullable: true })
  description!: string | null;

  @Column({ type: "date" })
  completionDate!: Date;

  @Column({ type: "jsonb", default: [] })
  images!: string[];

  @OneToMany(() => ProductTag, (tag) => tag.portfolioProject, {
    cascade: true,
    eager: true,
  })
  tags!: ProductTag[];

  @Column({ type: "timestamp with time zone", default: () => "now()" })
  createdAt!: Date;

  @Column({ type: "timestamp with time zone", default: () => "now()" })
  updatedAt!: Date;
}
