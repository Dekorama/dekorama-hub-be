export class AddMaterialDto {
  productSku!: string;
  productName!: string;
  quantity!: number;
  suggestedPrice!: number;
  discountPct?: number;
  unit?: string;
}
