import { UserRole } from "../users/user.entity";
import { CartItem } from "./cart.entity";
import { toProductPublicDto } from "../products/product.mapper";

export type CartItemPublicDto = {
  id: string;
  productSku: string;
  quantity: number;
  addedAt: Date;
  product: ReturnType<typeof toProductPublicDto> | null;
};

export type CartItemAdminDto = CartItemPublicDto & {
  unitPrice: number;
};

export function toCartItemDto(
  item: CartItem,
  role: UserRole,
): CartItemPublicDto | CartItemAdminDto {
  const product = item.product ? toProductPublicDto(item.product) : null;
  const base: CartItemPublicDto = {
    id: item.id,
    productSku: item.productSku,
    quantity: item.quantity,
    addedAt: item.addedAt,
    product,
  };

  if (role === UserRole.ADMIN) {
    return { ...base, unitPrice: Number(item.unitPrice) };
  }

  return base;
}

export function toCartItemDtoList(
  items: CartItem[],
  role: UserRole,
): Array<CartItemPublicDto | CartItemAdminDto> {
  return items.map((item) => toCartItemDto(item, role));
}
