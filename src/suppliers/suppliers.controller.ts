import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { SuppliersService } from "./suppliers.service";
import {
  CreateFactoryCodeDto,
  CreateSupplierDto,
  UpdateFactoryCodeDto,
  UpdateSupplierDto,
} from "./suppliers.dto";
import { SessionGuard } from "../auth/guards/session.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/user.decorator";
import { User, UserRole } from "../users/user.entity";
import { parseMarketFilter } from "../common/market-filter";

@Controller("suppliers")
@UseGuards(SessionGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Get("factory-codes/list")
  listFactoryCodes(
    @Query("supplierId") supplierId?: string,
    @Query("productSku") productSku?: string,
    @Query("market") market?: string,
  ) {
    return this.suppliersService.listFactoryCodes(
      supplierId,
      productSku,
      parseMarketFilter(market),
    );
  }

  @Post("factory-codes")
  createFactoryCode(
    @Body() dto: CreateFactoryCodeDto,
    @CurrentUser() user: User,
  ) {
    return this.suppliersService.createFactoryCode(dto, user);
  }

  @Patch("factory-codes/:fcId")
  updateFactoryCode(
    @Param("fcId") fcId: string,
    @Body() dto: UpdateFactoryCodeDto,
    @CurrentUser() user: User,
  ) {
    return this.suppliersService.updateFactoryCode(fcId, dto, user);
  }

  @Delete("factory-codes/:fcId")
  deleteFactoryCode(@Param("fcId") fcId: string, @CurrentUser() user: User) {
    return this.suppliersService.deleteFactoryCode(fcId, user);
  }

  @Get()
  list(
    @Query("includeInactive") includeInactive?: string,
    @Query("market") market?: string,
    @Query("familyCode") familyCode?: string,
  ) {
    return this.suppliersService.listSuppliers(
      includeInactive === "true",
      parseMarketFilter(market),
      familyCode,
    );
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.suppliersService.findSupplier(id);
  }

  @Post()
  create(@Body() dto: CreateSupplierDto, @CurrentUser() user: User) {
    return this.suppliersService.createSupplier(dto, user);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() dto: UpdateSupplierDto,
    @CurrentUser() user: User,
  ) {
    return this.suppliersService.updateSupplier(id, dto, user);
  }

  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser() user: User) {
    return this.suppliersService.deleteSupplier(id, user);
  }
}
