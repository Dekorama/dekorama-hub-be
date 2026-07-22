import {
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  IsNotEmpty,
  IsUUID,
  IsArray,
  ValidateNested,
  IsDateString,
  Min,
  Max,
  ArrayMinSize,
} from "class-validator";
import { Type } from "class-transformer";
import { InvoiceStatus } from "../entities/invoice.entity";

export class InvoiceLineItemDto {
  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsOptional()
  @IsString()
  productSku?: string;

  @IsNumber()
  @Min(1)
  quantity!: number;

  @IsNumber()
  @Min(0)
  unitPrice!: number;
}

export class CreateInvoiceFromProposalDto {
  @IsUUID()
  @IsNotEmpty()
  proposalId!: string;

  @IsDateString()
  @IsNotEmpty()
  issueDate!: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  taxRate!: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateInvoiceFromOrderDto {
  @IsUUID()
  orderId!: string;

  @IsOptional()
  @IsArray()
  @IsUUID("4", { each: true })
  orderLineItemIds?: string[];

  @IsDateString()
  issueDate!: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  taxRate!: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateManualInvoiceDto {
  @IsUUID()
  @IsNotEmpty()
  clientId!: string;

  @IsDateString()
  @IsNotEmpty()
  issueDate!: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  taxRate!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineItemDto)
  @ArrayMinSize(1)
  lineItems!: InvoiceLineItemDto[];

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateInvoiceDto {
  @IsOptional()
  @IsDateString()
  issueDate?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  taxRate?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineItemDto)
  @ArrayMinSize(1)
  lineItems?: InvoiceLineItemDto[];

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateInvoiceStatusDto {
  @IsEnum(InvoiceStatus)
  @IsNotEmpty()
  status!: InvoiceStatus;
}

export class InvoiceResponseDto {
  id!: string;
  invoiceNumber!: string;
  proposalId!: string | null;
  clientId!: string;
  clientName?: string;
  clientEmail?: string;
  issueDate!: Date;
  dueDate!: Date | null;
  subtotal!: number;
  taxRate!: number;
  taxAmount!: number;
  total!: number;
  status!: InvoiceStatus;
  notes!: string | null;
  pdfUrl?: string | null;
  createdBy!: string;
  createdByName?: string;
  lineItems!: Array<{
    id: string;
    description: string;
    productSku: string | null;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
  createdAt!: Date;
  updatedAt!: Date;
}
