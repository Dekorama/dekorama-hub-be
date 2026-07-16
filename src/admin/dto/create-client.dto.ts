import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
} from "class-validator";
import { MarketCode } from "../../common/market";

export class CreateClientDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsIn([MarketCode.VE, MarketCode.ES])
  country!: MarketCode;

  @IsOptional()
  @IsObject()
  profileData?: Record<string, unknown>;

  @IsOptional()
  @IsNumber()
  taxRate?: number | null;

  @IsOptional()
  @IsBoolean()
  taxExempt?: boolean;
}
