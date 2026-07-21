import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { User } from "../../users/user.entity";

export enum AdminInvitationStatus {
  PENDING = "pending",
  ACCEPTED = "accepted",
  EXPIRED = "expired",
  REVOKED = "revoked",
}

@Entity("admin_invitations")
export class AdminInvitation {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "sender_id", type: "uuid" })
  senderId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: "sender_id" })
  sender: User;

  @Column({ name: "invitee_email" })
  inviteeEmail: string;

  @Column()
  token: string;

  @Column({
    type: "varchar",
    length: 20,
    default: AdminInvitationStatus.PENDING,
  })
  status: AdminInvitationStatus;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;
}
