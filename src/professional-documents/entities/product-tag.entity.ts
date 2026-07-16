import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { PortfolioProject } from "./portfolio-project.entity";
import { Product } from "../../products/product.entity";

@Entity("product_tags")
export class ProductTag {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  portfolioProjectId!: string;

  @ManyToOne(() => PortfolioProject, (portfolio) => portfolio.tags, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "portfolioProjectId" })
  portfolioProject!: PortfolioProject;

  @Column({ type: "varchar", length: 100 })
  productSku!: string;

  @ManyToOne(() => Product, { eager: true })
  @JoinColumn({ name: "productSku", referencedColumnName: "sku" })
  product!: Product;

  @Column({ type: "varchar", length: 500 })
  imageUrl!: string;

  @Column({ type: "numeric", precision: 5, scale: 2 })
  positionX!: number;

  @Column({ type: "numeric", precision: 5, scale: 2 })
  positionY!: number;

  @Column({ type: "timestamp with time zone", default: () => "now()" })
  createdAt!: Date;
}
