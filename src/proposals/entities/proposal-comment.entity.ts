import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Proposal } from "../proposal.entity";
import { User } from "../../users/user.entity";

export enum ProposalCommentVisibility {
  CLIENT = "client",
  INTERNAL = "internal",
}

@Entity({ name: "proposal_comments" })
export class ProposalComment {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  proposalId!: string;

  @ManyToOne(() => Proposal, (p) => p.comments, { onDelete: "CASCADE" })
  @JoinColumn({ name: "proposalId" })
  proposal!: Proposal;

  @Column({ type: "uuid" })
  authorId!: string;

  @ManyToOne(() => User, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "authorId" })
  author!: User;

  @Column({ type: "text" })
  content!: string;

  @Column({
    type: "enum",
    enum: ProposalCommentVisibility,
    default: ProposalCommentVisibility.CLIENT,
  })
  visibility!: ProposalCommentVisibility;

  @Column({ type: "timestamp with time zone", default: () => "now()" })
  createdAt!: Date;
}
