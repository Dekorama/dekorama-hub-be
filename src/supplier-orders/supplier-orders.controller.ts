import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import { Response } from "express";
import { SupplierOrdersService } from "./supplier-orders.service";
import {
  CreateSupplierInvoiceDto,
  CreateSupplierOrderFromClientOrderDto,
  GenerateAllSupplierOrdersDto,
  UpdateSupplierInvoiceStatusDto,
  UpdateSupplierOrderStatusDto,
} from "./supplier-orders.dto";
import { SessionGuard } from "../auth/guards/session.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/user.decorator";
import { User, UserRole } from "../users/user.entity";
import { parseMarketFilter } from "../common/market-filter";

@Controller("supplier-orders")
@UseGuards(SessionGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class SupplierOrdersController {
  constructor(private readonly supplierOrdersService: SupplierOrdersService) {}

  @Get()
  list(
    @Query("market") market?: string,
    @Query("clientOrderId") clientOrderId?: string,
  ) {
    return this.supplierOrdersService.list(parseMarketFilter(market), clientOrderId);
  }

  @Get("invoices/list")
  listInvoices(@Query("market") market?: string) {
    return this.supplierOrdersService.listSupplierInvoices(parseMarketFilter(market));
  }

  @Get("preview/:clientOrderId")
  getSupplierPreview(
    @Param("clientOrderId") clientOrderId: string,
    @CurrentUser() user: User,
  ) {
    return this.supplierOrdersService.getSupplierPreview(clientOrderId, user);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.supplierOrdersService.findById(id);
  }

  @Get(":id/pdf")
  async downloadPdf(@Param("id") id: string, @Res() res: Response) {
    const buffer = await this.supplierOrdersService.generatePdf(id);
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="po-${id}.pdf"`,
      "Content-Length": buffer.length,
    });
    res.end(buffer);
  }

  @Post("from-client-order/:clientOrderId")
  createFromClientOrder(
    @Param("clientOrderId") clientOrderId: string,
    @Body() dto: CreateSupplierOrderFromClientOrderDto,
    @CurrentUser() user: User,
  ) {
    return this.supplierOrdersService.createFromClientOrder(clientOrderId, dto, user);
  }

  @Post("from-client-order/:clientOrderId/generate-all")
  generateAllFromClientOrder(
    @Param("clientOrderId") clientOrderId: string,
    @Body() dto: GenerateAllSupplierOrdersDto,
    @CurrentUser() user: User,
  ) {
    return this.supplierOrdersService.generateAllFromClientOrder(
      clientOrderId,
      dto,
      user,
    );
  }

  @Post(":id/send-email")
  sendEmail(@Param("id") id: string, @CurrentUser() user: User) {
    return this.supplierOrdersService.sendEmail(id, user);
  }

  @Patch(":id/status")
  updateStatus(
    @Param("id") id: string,
    @Body() dto: UpdateSupplierOrderStatusDto,
    @CurrentUser() user: User,
  ) {
    return this.supplierOrdersService.updateStatus(id, dto, user);
  }

  @Post("invoices")
  createInvoice(@Body() dto: CreateSupplierInvoiceDto, @CurrentUser() user: User) {
    return this.supplierOrdersService.createSupplierInvoice(dto, user);
  }

  @Patch("invoices/:id/status")
  updateInvoiceStatus(
    @Param("id") id: string,
    @Body() dto: UpdateSupplierInvoiceStatusDto,
    @CurrentUser() user: User,
  ) {
    return this.supplierOrdersService.updateSupplierInvoiceStatus(id, dto, user);
  }
}
