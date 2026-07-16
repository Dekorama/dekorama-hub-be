import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { User } from "../../users/user.entity";

export enum InvitationStatus {
  PENDING = "pending",
  ACCEPTED = "accepted",
  EXPIRED = "expired",
}

@Entity({ name: "community_invitations" })
export class CommunityInvitation {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  organizerId!: string;

  @ManyToOne(() => User)
  organizer!: User;

  @Column({ type: "varchar", length: 150 })
  inviteeEmail!: string;

  @Column({ type: "text" })
  token!: string;

  @Column({ type: "enum", enum: InvitationStatus, default: InvitationStatus.PENDING })
  status!: InvitationStatus;

  @CreateDateColumn({ type: "timestamp with time zone" })
  createdAt!: Date;
}
