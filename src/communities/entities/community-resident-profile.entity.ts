import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { User } from "../../users/user.entity";

@Entity("community_resident_profiles")
export class CommunityResidentProfile {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "user_id", unique: true })
  userId!: string;

  @OneToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: User;

  @Column({ name: "unit_number", type: "varchar", length: 50, nullable: true })
  unitNumber!: string | null;

  @Column({ type: "varchar", length: 20, nullable: true })
  floor!: string | null;

  @Column({ name: "is_occupant", type: "boolean", default: true })
  isOccupant!: boolean;

  @Column({ type: "text", nullable: true })
  notes!: string | null;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;
}
