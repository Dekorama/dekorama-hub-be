import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from "class-validator";
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
