import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from "@nestjs/common";
import { CartService } from "./cart.service";
import { AddToCartDto, SubmitSolicitudDto, UpdateCartItemDto } from "./cart.dto";
import { toCartItemDto, toCartItemDtoList } from "./cart.mapper";
import { SessionGuard } from "../auth/guards/session.guard";
import { CurrentUser } from "../auth/decorators/user.decorator";
import { User } from "../users/user.entity";

@Controller("cart")
@UseGuards(SessionGuard)
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  async getCart(@CurrentUser() user: User) {
    const items = await this.cartService.list(user.id);
    return toCartItemDtoList(items, user.role);
  }

  @Post()
  async addToCart(@Body() dto: AddToCartDto, @CurrentUser() user: User) {
    const item = await this.cartService.addItem(user.id, dto);
    return toCartItemDto(item, user.role);
  }

  @Patch(":itemId")
  async updateCartItem(
    @Param("itemId") itemId: string,
    @Body() dto: UpdateCartItemDto,
    @CurrentUser() user: User,
  ) {
    const item = await this.cartService.updateItem(itemId, user.id, dto);
    return toCartItemDto(item, user.role);
  }

  @Delete(":itemId")
  async removeCartItem(
    @Param("itemId") itemId: string,
    @CurrentUser() user: User,
  ) {
    await this.cartService.removeItem(itemId, user.id);
    return { message: "Item removed from cart" };
  }

  @Delete()
  async clearCart(@CurrentUser() user: User) {
    await this.cartService.clear(user.id);
    return { message: "Cart cleared" };
  }

  @Post("import-from-proposal/:proposalId")
  async importFromProposal(
    @Param("proposalId") proposalId: string,
    @CurrentUser() user: User,
  ) {
    const result = await this.cartService.importFromProposal(proposalId, user);
    return {
      cartItems: toCartItemDtoList(result.cartItems, user.role),
      totalAmount: result.totalAmount,
    };
  }

  @Post("import-from-project/:projectId")
  async importFromProject(
    @Param("projectId") projectId: string,
    @CurrentUser() user: User,
  ) {
    const result = await this.cartService.importFromProject(projectId, user);
    return {
      cartItems: toCartItemDtoList(result.cartItems, user.role),
      totalAmount: result.totalAmount,
    };
  }

  @Post("submit-solicitud")
  async submitSolicitud(
    @Body() dto: SubmitSolicitudDto,
    @CurrentUser() user: User,
  ) {
    return this.cartService.submitSolicitud(user, dto);
  }
}
