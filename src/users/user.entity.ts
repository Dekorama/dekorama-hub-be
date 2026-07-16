import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";
import { MarketCode } from "../common/market";

export enum UserRole {
  ADMIN = "admin",
  PROFESSIONAL = "professional",
  CLIENT = "client",
}

export enum AccountType {
  INDIVIDUAL = "individual",
  COMMUNITY = "community",
  MEMBER = "member",
}

@Entity({ name: "users" })
export class User {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar", length: 150 })
  name!: string;

  @Column({ type: "varchar", length: 150, unique: true })
  email!: string;

  @Column({ type: "varchar", length: 255 })
  passwordHash!: string;

  @Column({ type: "enum", enum: UserRole, default: UserRole.CLIENT })
  role!: UserRole;

  @Column({ type: "enum", enum: AccountType, nullable: true })
  accountType!: AccountType | null;

  @Column({ type: "uuid", nullable: true })
  parentAccountId!: string | null;

  @Column({ type: "boolean", default: false })
  isVerified!: boolean;

  @Column({ type: "varchar", length: 2, default: MarketCode.VE })
  country!: MarketCode;

  @Column({ type: "numeric", precision: 5, scale: 2, nullable: true })
  taxRate!: number | null;

  @Column({ type: "boolean", default: false })
  taxExempt!: boolean;

  @Column({ type: "jsonb", nullable: true })
  profileData!: Record<string, unknown> | null;

  @Column({ type: "timestamp with time zone", default: () => "now()" })
  createdAt!: Date;
}
