import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import ExcelJS from "exceljs";
import { Invoice } from "../invoices/entities/invoice.entity";
import { ClientOrder } from "../orders/entities/client-order.entity";
import { SupplierOrder } from "../supplier-orders/entities/supplier-order.entity";
import { SupplierInvoice } from "../supplier-orders/entities/supplier-invoice.entity";
import { Product } from "../products/product.entity";
import { MarketCode } from "../common/market";

@Injectable()
export class ExportsService {
  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(ClientOrder)
    private readonly orderRepo: Repository<ClientOrder>,
    @InjectRepository(SupplierOrder)
    private readonly supplierOrderRepo: Repository<SupplierOrder>,
    @InjectRepository(SupplierInvoice)
    private readonly supplierInvoiceRepo: Repository<SupplierInvoice>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
  ) {}

  async exportInvoices(
    startDate?: string,
    endDate?: string,
    market?: MarketCode,
  ): Promise<Buffer> {
    const qb = this.invoiceRepo
      .createQueryBuilder("i")
      .leftJoinAndSelect("i.client", "client")
      .leftJoinAndSelect("i.lineItems", "lineItems")
      .orderBy("i.issueDate", "DESC");

    if (startDate) qb.andWhere("i.issueDate >= :startDate", { startDate });
    if (endDate) qb.andWhere("i.issueDate <= :endDate", { endDate });
    if (market) qb.andWhere("client.country = :market", { market });

    const invoices = await qb.getMany();
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Facturas");
    ws.addRow(["Número", "Cliente", "Fecha", "Subtotal", "IVA", "Total", "Estado"]);

    for (const inv of invoices) {
      ws.addRow([
        inv.invoiceNumber,
        inv.client?.email ?? "",
        inv.issueDate,
        Number(inv.subtotal),
        Number(inv.taxAmount),
        Number(inv.total),
        inv.status,
      ]);
    }

    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  async exportOrders(
    startDate?: string,
    endDate?: string,
    market?: MarketCode,
  ): Promise<Buffer> {
    const qb = this.orderRepo
      .createQueryBuilder("o")
      .leftJoinAndSelect("o.client", "client")
      .leftJoinAndSelect("o.lineItems", "lineItems")
      .orderBy("o.createdAt", "DESC");

    if (market) qb.andWhere("client.country = :market", { market });

    const orders = await qb.getMany();
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Pedidos");
    ws.addRow(["Número", "Cliente", "Estado", "Subtotal", "Total", "Fecha"]);

    for (const o of orders) {
      if (startDate && o.createdAt < new Date(startDate)) continue;
      if (endDate && o.createdAt > new Date(endDate)) continue;
      ws.addRow([
        o.orderNumber,
        o.client?.email ?? "",
        o.status,
        Number(o.subtotal),
        Number(o.total),
        o.createdAt,
      ]);
    }

    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  async exportSupplierOrders(market?: MarketCode): Promise<Buffer> {
    const qb = this.supplierOrderRepo
      .createQueryBuilder("so")
      .leftJoinAndSelect("so.supplier", "supplier")
      .leftJoinAndSelect("so.clientOrder", "clientOrder")
      .leftJoinAndSelect("clientOrder.client", "client")
      .leftJoinAndSelect("so.lineItems", "lineItems")
      .orderBy("so.createdAt", "DESC");

    if (market) qb.andWhere("client.country = :market", { market });

    const orders = await qb.getMany();
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Pedidos Proveedor");
    ws.addRow(["Número", "Proveedor", "Estado", "Fecha"]);

    for (const o of orders) {
      ws.addRow([o.orderNumber, o.supplier?.name ?? "", o.status, o.createdAt]);
    }

    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  async exportSupplierInvoices(market?: MarketCode): Promise<Buffer> {
    const qb = this.supplierInvoiceRepo
      .createQueryBuilder("si")
      .leftJoinAndSelect("si.supplier", "supplier")
      .leftJoinAndSelect("si.supplierOrder", "supplierOrder")
      .leftJoinAndSelect("supplierOrder.clientOrder", "clientOrder")
      .leftJoinAndSelect("clientOrder.client", "client")
      .orderBy("si.createdAt", "DESC");

    if (market) qb.andWhere("client.country = :market", { market });

    const invoices = await qb.getMany();
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Facturas Proveedor");
    ws.addRow(["Número", "Proveedor", "Fecha", "Monto", "Estado"]);

    for (const inv of invoices) {
      ws.addRow([
        inv.invoiceNumber,
        inv.supplier?.name ?? "",
        inv.issueDate,
        Number(inv.amount),
        inv.status,
      ]);
    }

    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  async exportProducts(market?: MarketCode): Promise<Buffer> {
    const where = market ? { market } : {};
    const products = await this.productRepo.find({ where, order: { name: "ASC" } });
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Productos");
    ws.addRow(["SKU", "Nombre", "Familia", "Mercado", "PVP", "Stock", "Activo"]);

    for (const p of products) {
      ws.addRow([
        p.sku,
        p.name,
        p.familyName,
        p.market,
        Number(p.pvpPrice),
        p.stock,
        p.isActive,
      ]);
    }

    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  async exportSalesLedger(
    startDate?: string,
    endDate?: string,
    market?: MarketCode,
  ): Promise<Buffer> {
    return this.exportInvoices(startDate, endDate, market);
  }
}
