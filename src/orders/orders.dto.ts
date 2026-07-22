import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { ClientOrderStatus } from "./entities/client-order.entity";

export class CreateOrderFromProposalDto {
  @IsOptional()
  @IsArray()
  @IsUUID("4", { each: true })
  materialListIds?: string[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  taxRate?: number;

  @IsOptional()
  @IsString()
  externalNotes?: string;

  @IsOptional()
  @IsString()
  internalNotes?: string;
}

export class UpdateOrderStatusDto {
  @IsEnum(ClientOrderStatus)
  status!: ClientOrderStatus;
}

export class UpdateOrderLineItemDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsString()
  productSku!: string;

  @IsOptional()
  @IsString()
  productName?: string;

  @IsNumber()
  @Min(0)
  quantityOrdered!: number;

  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discountPct?: number;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsString()
  externalComment?: string | null;

  @IsOptional()
  @IsString()
  internalComment?: string | null;

  @IsOptional()
  @IsUUID()
  proposalMaterialListId?: string | null;
}

export class UpdateOrderSectionDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateOrderLineItemDto)
  lineItems!: UpdateOrderLineItemDto[];
}

export class UpdateOrderDto {
  @IsOptional()
  @IsString()
  externalNotes?: string | null;

  @IsOptional()
  @IsString()
  internalNotes?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  taxRate?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateOrderSectionDto)
  sections?: UpdateOrderSectionDto[];

  /** Flat line items when not using sections */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateOrderLineItemDto)
  lineItems?: UpdateOrderLineItemDto[];
}
