import { Controller, Get, Query, Res, UseGuards } from "@nestjs/common";
import { Response } from "express";
import { ExportsService } from "./exports.service";
import { SessionGuard } from "../auth/guards/session.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { UserRole } from "../users/user.entity";
import { parseMarketFilter } from "../common/market-filter";

@Controller("admin/exports")
@UseGuards(SessionGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class ExportsController {
  constructor(private readonly exportsService: ExportsService) {}

  private sendExcel(res: Response, buffer: Buffer, filename: string) {
    res.set({
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": buffer.length,
    });
    res.end(buffer);
  }

  @Get("invoices")
  async exportInvoices(
    @Query("startDate") startDate: string,
    @Query("endDate") endDate: string,
    @Query("market") market: string,
    @Res() res: Response,
  ) {
    const buffer = await this.exportsService.exportInvoices(
      startDate,
      endDate,
      parseMarketFilter(market),
    );
    this.sendExcel(res, buffer, "facturas.xlsx");
  }

  @Get("orders")
  async exportOrders(
    @Query("startDate") startDate: string,
    @Query("endDate") endDate: string,
    @Query("market") market: string,
    @Res() res: Response,
  ) {
    const buffer = await this.exportsService.exportOrders(
      startDate,
      endDate,
      parseMarketFilter(market),
    );
    this.sendExcel(res, buffer, "pedidos.xlsx");
  }

  @Get("supplier-orders")
  async exportSupplierOrders(@Query("market") market: string, @Res() res: Response) {
    const buffer = await this.exportsService.exportSupplierOrders(parseMarketFilter(market));
    this.sendExcel(res, buffer, "pedidos-proveedor.xlsx");
  }

  @Get("supplier-invoices")
  async exportSupplierInvoices(@Query("market") market: string, @Res() res: Response) {
    const buffer = await this.exportsService.exportSupplierInvoices(parseMarketFilter(market));
    this.sendExcel(res, buffer, "facturas-proveedor.xlsx");
  }

  @Get("products")
  async exportProducts(@Query("market") market: string, @Res() res: Response) {
    const buffer = await this.exportsService.exportProducts(parseMarketFilter(market));
    this.sendExcel(res, buffer, "productos.xlsx");
  }

  @Get("sales-ledger")
  async exportSalesLedger(
    @Query("startDate") startDate: string,
    @Query("endDate") endDate: string,
    @Query("market") market: string,
    @Res() res: Response,
  ) {
    const buffer = await this.exportsService.exportSalesLedger(
      startDate,
      endDate,
      parseMarketFilter(market),
    );
    this.sendExcel(res, buffer, "libro-ventas.xlsx");
  }
}
