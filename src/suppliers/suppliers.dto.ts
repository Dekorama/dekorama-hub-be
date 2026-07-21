import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  Min,
} from "class-validator";
import { MarketCode } from "../common/market";

export const SUPPLIER_LEGAL_TYPES = ["particular", "empresa"] as const;
export const SUPPLIER_DOCUMENT_TYPES = [
  "dni",
  "nie",
  "nif",
  "cif",
  "cedula",
  "rif",
] as const;

export class CreateSupplierDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  /** 3-letter SKU prefix (unique). Auto-generated from name if omitted. */
  @IsOptional()
  @IsString()
  @Length(3, 3)
  prefix?: string;

  /** Families this supplier serves (1:N). */
  @IsArray()
  @IsString({ each: true })
  @Length(3, 3, { each: true })
  familyCodes!: string[];

  @IsOptional()
  @IsIn(SUPPLIER_LEGAL_TYPES)
  legalType?: (typeof SUPPLIER_LEGAL_TYPES)[number] | null;

  @IsOptional()
  @IsIn(SUPPLIER_DOCUMENT_TYPES)
  documentType?: (typeof SUPPLIER_DOCUMENT_TYPES)[number] | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  documentNumber?: string | null;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  emails?: string[];

  @IsOptional()
  @IsEnum(MarketCode)
  market?: MarketCode;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  phones?: string[];

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
  @IsString()
  @Length(3, 3)
  prefix?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Length(3, 3, { each: true })
  familyCodes?: string[];

  @IsOptional()
  @IsIn(SUPPLIER_LEGAL_TYPES)
  legalType?: (typeof SUPPLIER_LEGAL_TYPES)[number] | null;

  @IsOptional()
  @IsIn(SUPPLIER_DOCUMENT_TYPES)
  documentType?: (typeof SUPPLIER_DOCUMENT_TYPES)[number] | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  documentNumber?: string | null;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  emails?: string[];

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  phones?: string[];

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
