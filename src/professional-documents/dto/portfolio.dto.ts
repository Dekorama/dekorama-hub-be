import {
  IsString,
  IsNumber,
  IsArray,
  IsOptional,
  IsNotEmpty,
  IsDateString,
  Length,
  Min,
  Max,
  ArrayMinSize,
  ArrayMaxSize,
  IsUrl,
} from "class-validator";

export class CreatePortfolioDto {
  @IsString()
  @IsNotEmpty()
  @Length(3, 200)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsDateString()
  completionDate!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsUrl({}, { each: true })
  images!: string[];
}

export class CreateProductTagDto {
  @IsString()
  @IsNotEmpty()
  productSku!: string;

  @IsString()
  @IsNotEmpty()
  @IsUrl()
  imageUrl!: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  positionX!: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  positionY!: number;
}
