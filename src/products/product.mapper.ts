import { UserRole } from "../users/user.entity";
import { Product } from "./product.entity";

export type ProductPublicDto = {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  family: string;
  familyName: string;
  subfamily: string;
  subfamilyName: string;
  unit: string;
  piecesPerBox: number | null;
  unitPerPiece: number | null;
  finishType: string | null;
  stock: number;
  isActive: boolean;
  market: string;
};

export type ProductAdminDto = ProductPublicDto & {
  pricingMode: string;
  factoryCost: number;
  profitMargin: number;
  pvpPrice: number;
  createdAt: Date;
  updatedAt: Date;
};

export function toProductPublicDto(product: Product): ProductPublicDto {
  return {
    id: product.id,
    sku: product.sku,
    name: product.name,
    description: product.description,
    imageUrl: product.imageUrl,
    family: product.family,
    familyName: product.familyName,
    subfamily: product.subfamily,
    subfamilyName: product.subfamilyName,
    unit: product.unit,
    piecesPerBox: product.piecesPerBox,
    unitPerPiece: product.unitPerPiece != null ? Number(product.unitPerPiece) : null,
    finishType: product.finishType,
    stock: product.stock,
    isActive: product.isActive,
    market: product.market,
  };
}

export function toProductDto(
  product: Product,
  role: UserRole,
): ProductPublicDto | ProductAdminDto {
  if (role === UserRole.ADMIN) {
    return {
      ...toProductPublicDto(product),
      pricingMode: product.pricingMode,
      factoryCost: Number(product.factoryCost),
      profitMargin: Number(product.profitMargin),
      pvpPrice: Number(product.pvpPrice),
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }
  return toProductPublicDto(product);
}

export function toProductDtoList(
  products: Product[],
  role: UserRole,
): Array<ProductPublicDto | ProductAdminDto> {
  return products.map((p) => toProductDto(p, role));
}
