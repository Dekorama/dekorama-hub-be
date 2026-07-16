import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsNotEmpty,
  Length,
  Min,
  Max,
  IsIn,
  ValidateIf,
  IsUUID,
} from "class-validator";
import { MarketCode } from "../common/market";
import { FinishType, PricingMode } from "./product.entity";

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  @Length(3, 255)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @Length(3, 3)
  family!: string;

  /** Ignored when supplierId is provided — subfamilia se deriva del proveedor. */
  @IsOptional()
  @IsString()
  @Length(3, 3)
  subfamily?: string;

  @IsUUID()
  supplierId!: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  factoryCode!: string;

  @IsOptional()
  @IsIn([PricingMode.NETO, PricingMode.PVP])
  pricingMode?: PricingMode;

  @ValidateIf((o: CreateProductDto) => o.family === "REV")
  @IsIn([FinishType.DECORADO, FinishType.PIEZA_LISA])
  finishType?: FinishType | null;

  @ValidateIf((o: CreateProductDto) => (o.pricingMode ?? PricingMode.NETO) === PricingMode.NETO)
  @IsNumber()
  @Min(0)
  factoryCost!: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  profitMargin!: number;

  @ValidateIf((o: CreateProductDto) => o.pricingMode === PricingMode.PVP)
  @IsNumber()
  @Min(0)
  pvpPrice?: number;

  @IsOptional()
  @IsString()
  @Length(1, 50)
  unit?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  stock?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsIn([MarketCode.VE, MarketCode.ES])
  market?: MarketCode;
}

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @Length(3, 255)
  name?: string;

  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  factoryCode?: string;

  @IsOptional()
  @IsIn([PricingMode.NETO, PricingMode.PVP])
  pricingMode?: PricingMode;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsIn([FinishType.DECORADO, FinishType.PIEZA_LISA])
  finishType?: FinishType | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  factoryCost?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  profitMargin?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  pvpPrice?: number;

  @IsOptional()
  @IsString()
  @Length(1, 50)
  unit?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  stock?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsIn([MarketCode.VE, MarketCode.ES])
  market?: MarketCode;
}

export class FamilyDto {
  code!: string;
  name!: string;
  description!: string | null;
  icon!: string | null;
}

export class SubfamilyDto {
  code!: string;
  familyCode!: string;
  name!: string;
  description!: string | null;
  supplierId?: string | null;
}

export class CreateFamilyDto {
  @IsString()
  @IsNotEmpty()
  @Length(3, 3)
  code!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  icon?: string;
}

export class UpdateFamilyDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsString()
  icon?: string | null;
}

export class CreateSubfamilyDto {
  @IsString()
  @IsNotEmpty()
  @Length(3, 3)
  code!: string;

  @IsString()
  @IsNotEmpty()
  @Length(3, 3)
  familyCode!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  supplierId?: string;
}

export class UpdateSubfamilyDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string | null;
}
