import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from "class-validator";
import { SupplierInvoiceStatus } from "./entities/supplier-invoice.entity";
import { SupplierOrderStatus } from "./entities/supplier-order.entity";

export class CreateSupplierOrderFromClientOrderDto {
  @IsUUID()
  supplierId!: string;

  @IsOptional()
  @IsArray()
  @IsUUID("4", { each: true })
  clientOrderLineItemIds?: string[];

  @IsOptional()
  @IsString()
  notes?: string;
}

export class GenerateAllSupplierOrdersDto {
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateSupplierOrderStatusDto {
  @IsEnum(SupplierOrderStatus)
  status!: SupplierOrderStatus;
}

export class CreateSupplierInvoiceDto {
  @IsUUID()
  supplierOrderId!: string;

  @IsString()
  @IsNotEmpty()
  invoiceNumber!: string;

  @IsDateString()
  issueDate!: string;

  @IsNumber()
  @Min(0)
  amount!: number;

  @IsOptional()
  @IsString()
  fileUrl?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateSupplierInvoiceStatusDto {
  @IsEnum(SupplierInvoiceStatus)
  status!: SupplierInvoiceStatus;
}
