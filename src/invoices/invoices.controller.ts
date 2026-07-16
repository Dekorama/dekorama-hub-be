import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Res,
  ForbiddenException,
} from "@nestjs/common";
import { Response } from "express";
import { InvoicesService } from "./invoices.service";
import {
  CreateInvoiceFromProposalDto,
  CreateInvoiceFromOrderDto,
  CreateManualInvoiceDto,
  UpdateInvoiceDto,
  UpdateInvoiceStatusDto,
} from "./dto/invoice.dto";
import { SessionGuard } from "../auth/guards/session.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/user.decorator";
import { User, UserRole } from "../users/user.entity";
import { InvoiceStatus } from "./entities/invoice.entity";
import { parseMarketFilter } from "../common/market-filter";

@Controller("invoices")
@UseGuards(SessionGuard)
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get()
  async list(
    @CurrentUser() user: User,
    @Query("status") status?: InvoiceStatus,
    @Query("clientId") clientId?: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
    @Query("market") market?: string,
  ) {
    if (user.role !== UserRole.ADMIN) {
      return this.invoicesService.list({
        status,
        clientId: user.id,
        startDate,
        endDate,
      });
    }
    return this.invoicesService.list({
      status,
      clientId,
      startDate,
      endDate,
      market: parseMarketFilter(market),
    });
  }

  @Get(":id")
  async findById(@Param("id") id: string, @CurrentUser() user: User) {
    const invoice = await this.invoicesService.findById(id);
    if (user.role !== UserRole.ADMIN && invoice.clientId !== user.id) {
      throw new ForbiddenException("Acceso denegado");
    }
    return invoice;
  }

  @Get(":id/pdf")
  async downloadPdf(
    @Param("id") id: string,
    @CurrentUser() user: User,
    @Res() res: Response,
  ) {
    const invoice = await this.invoicesService.findById(id);
    if (user.role !== UserRole.ADMIN && invoice.clientId !== user.id) {
      throw new ForbiddenException("Acceso denegado");
    }
    const buffer = await this.invoicesService.generatePdf(id);
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="invoice-${id}.pdf"`,
      "Content-Length": buffer.length,
    });
    res.end(buffer);
  }

  @Post("from-proposal")
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async createFromProposal(
    @Body() dto: CreateInvoiceFromProposalDto,
    @CurrentUser() user: User,
  ) {
    return this.invoicesService.createFromProposal(dto, user.id);
  }

  @Post("from-order")
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async createFromOrder(
    @Body() dto: CreateInvoiceFromOrderDto,
    @CurrentUser() user: User,
  ) {
    return this.invoicesService.createFromOrder(dto, user.id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async createManual(
    @Body() dto: CreateManualInvoiceDto,
    @CurrentUser() user: User,
  ) {
    return this.invoicesService.createManual(dto, user.id);
  }

  @Patch(":id")
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateInvoiceDto,
    @CurrentUser() user: User,
  ) {
    return this.invoicesService.update(id, dto, user.id);
  }

  @Patch(":id/status")
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async updateStatus(
    @Param("id") id: string,
    @Body() dto: UpdateInvoiceStatusDto,
    @CurrentUser() user: User,
  ) {
    return this.invoicesService.updateStatus(id, dto, user.id);
  }

  @Delete(":id")
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async delete(@Param("id") id: string, @CurrentUser() user: User) {
    await this.invoicesService.delete(id, user.id);
    return { message: "Invoice deleted successfully" };
  }
}
