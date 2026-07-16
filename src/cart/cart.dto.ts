import { IsString, IsNumber, IsNotEmpty, Min, IsOptional, IsUUID } from "class-validator";

export class AddToCartDto {
  @IsString()
  @IsNotEmpty()
  productSku!: string;

  @IsNumber()
  @Min(1)
  quantity!: number;
}

export class UpdateCartItemDto {
  @IsNumber()
  @Min(1)
  quantity!: number;
}

export class SubmitSolicitudDto {
  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @IsUUID()
  projectId?: string;
}
