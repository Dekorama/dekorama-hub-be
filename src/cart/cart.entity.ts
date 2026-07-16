import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { User } from "../users/user.entity";
import { Product } from "../products/product.entity";

@Entity("cart_items")
export class CartItem {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  userId!: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user!: User;

  @Column({ type: "varchar", length: 100 })
  productSku!: string;

  @ManyToOne(() => Product, { eager: true })
  @JoinColumn({ name: "productSku", referencedColumnName: "sku" })
  product!: Product;

  @Column({ type: "int" })
  quantity!: number;

  @Column({ type: "numeric", precision: 12, scale: 2 })
  unitPrice!: number;

  @Column({ type: "timestamp with time zone", default: () => "now()" })
  addedAt!: Date;
}
