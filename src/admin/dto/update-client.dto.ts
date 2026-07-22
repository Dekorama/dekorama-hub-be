import {
  IsBoolean,
  IsEmail,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
} from "class-validator";

export class UpdateClientDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsNumber()
  taxRate?: number | null;

  @IsOptional()
  @IsBoolean()
  taxExempt?: boolean;

  /** Shallow-merged into existing profileData (client contact fields). */
  @IsOptional()
  @IsObject()
  profileData?: Record<string, unknown>;
}
