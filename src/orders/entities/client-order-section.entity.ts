import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { ClientOrder } from "./client-order.entity";
import { ClientOrderLineItem } from "./client-order-line-item.entity";

@Entity({ name: "client_order_sections" })
export class ClientOrderSection {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  orderId!: string;

  @ManyToOne(() => ClientOrder, (o) => o.sections, { onDelete: "CASCADE" })
  @JoinColumn({ name: "orderId" })
  order!: ClientOrder;

  @Column({ type: "varchar", length: 255 })
  name!: string;

  @Column({ type: "int", default: 0 })
  sortOrder!: number;

  @OneToMany(() => ClientOrderLineItem, (item) => item.section)
  lineItems!: ClientOrderLineItem[];
}
