import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from "class-validator";
import { MarketCode } from "../common/market";

export class CreateSupplierDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsEnum(MarketCode)
  market?: MarketCode;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  accountNumber?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  taxRate?: number | null;

  @IsOptional()
  @IsBoolean()
  taxExempt?: boolean;
}

export class UpdateSupplierDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  accountNumber?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  taxRate?: number | null;

  @IsOptional()
  @IsBoolean()
  taxExempt?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateFactoryCodeDto {
  @IsUUID()
  supplierId!: string;

  @IsString()
  @IsNotEmpty()
  productSku!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  factoryCode!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  factoryCost?: number;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

export class UpdateFactoryCodeDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  factoryCode?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  factoryCost?: number;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}
