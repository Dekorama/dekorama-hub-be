import { IsEmail, IsIn, IsNotEmpty, IsObject, IsOptional, IsString, MinLength } from "class-validator";
import { AccountType, UserRole } from "../../users/user.entity";
import { MarketCode } from "../../common/market";

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsIn([UserRole.PROFESSIONAL, UserRole.CLIENT])
  role!: UserRole.PROFESSIONAL | UserRole.CLIENT;

  @IsOptional()
  @IsIn([AccountType.INDIVIDUAL, AccountType.COMMUNITY])
  accountType?: AccountType.INDIVIDUAL | AccountType.COMMUNITY;

  @IsIn([MarketCode.VE, MarketCode.ES])
  country!: MarketCode;

  @IsOptional()
  @IsObject()
  profileData?: Record<string, unknown>;
}
