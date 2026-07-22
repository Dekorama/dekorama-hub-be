import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { OrdersService } from "./orders.service";
import {
  CreateOrderFromProposalDto,
  UpdateOrderDto,
  UpdateOrderStatusDto,
} from "./orders.dto";
import { SessionGuard } from "../auth/guards/session.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/user.decorator";
import { User, UserRole } from "../users/user.entity";
import { ClientOrderStatus } from "./entities/client-order.entity";
import { parseMarketFilter } from "../common/market-filter";
import { SupplierOrdersService } from "../supplier-orders/supplier-orders.service";

@Controller("orders")
@UseGuards(SessionGuard)
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly supplierOrdersService: SupplierOrdersService,
  ) {}

  @Get()
  async list(
    @CurrentUser() user: User,
    @Query("status") status?: ClientOrderStatus,
    @Query("market") market?: string,
  ) {
    const clientId = user.role === UserRole.ADMIN ? undefined : user.id;
    const marketFilter =
      user.role === UserRole.ADMIN ? parseMarketFilter(market) : undefined;
    return this.ordersService.list({ clientId, status, market: marketFilter });
  }

  @Get(":id")
  async findOne(@Param("id") id: string, @CurrentUser() user: User) {
    return this.ordersService.findById(id, user);
  }

  @Get(":id/supplier-preview")
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  getSupplierPreview(@Param("id") id: string, @CurrentUser() user: User) {
    return this.supplierOrdersService.getSupplierPreview(id, user);
  }

  @Post("from-proposal/:proposalId")
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async createFromProposal(
    @Param("proposalId") proposalId: string,
    @Body() dto: CreateOrderFromProposalDto,
    @CurrentUser() user: User,
  ) {
    return this.ordersService.createFromProposal(proposalId, dto, user);
  }

  @Patch(":id/status")
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async updateStatus(
    @Param("id") id: string,
    @Body() dto: UpdateOrderStatusDto,
    @CurrentUser() user: User,
  ) {
    return this.ordersService.updateStatus(id, dto, user);
  }

  @Patch(":id")
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateOrderDto,
    @CurrentUser() user: User,
  ) {
    return this.ordersService.update(id, dto, user);
  }
}
