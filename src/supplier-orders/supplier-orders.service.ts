import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { DataSource, EntityManager, Repository } from "typeorm";
import PDFDocument from "pdfkit";
import {
  SupplierOrder,
  SupplierOrderStatus,
} from "./entities/supplier-order.entity";
import { SupplierOrderLineItem } from "./entities/supplier-order-line-item.entity";
import {
  SupplierInvoice,
  SupplierInvoiceStatus,
} from "./entities/supplier-invoice.entity";
import {
  ClientOrder,
  ClientOrderStatus,
} from "../orders/entities/client-order.entity";
import { ClientOrderLineItem } from "../orders/entities/client-order-line-item.entity";
import { Supplier } from "../suppliers/entities/supplier.entity";
import { FactoryCode } from "../suppliers/entities/factory-code.entity";
import { normalizeUnit } from "../common/line-item.utils";
import { User, UserRole } from "../users/user.entity";
import { EmailService } from "../email/email.service";
import {
  CreateSupplierInvoiceDto,
  CreateSupplierOrderFromClientOrderDto,
  GenerateAllSupplierOrdersDto,
  UpdateSupplierInvoiceStatusDto,
  UpdateSupplierOrderStatusDto,
} from "./supplier-orders.dto";
import { generateSequentialNumber } from "../common/generate-sequential-number";
import { MarketCode } from "../common/market";
import { MarketSettingsService } from "../admin/market-settings.service";
import { GcsService } from "../gcs/gcs.service";
import {
  GenerateAllSupplierOrdersResult,
  SupplierPreviewGroup,
  SupplierPreviewLine,
  SupplierPreviewResponse,
} from "./supplier-order-preview.types";

@Injectable()
export class SupplierOrdersService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRepository(SupplierOrder)
    private readonly supplierOrderRepo: Repository<SupplierOrder>,
    @InjectRepository(SupplierOrderLineItem)
    private readonly lineItemRepo: Repository<SupplierOrderLineItem>,
    @InjectRepository(SupplierInvoice)
    private readonly supplierInvoiceRepo: Repository<SupplierInvoice>,
    @InjectRepository(ClientOrder)
    private readonly clientOrderRepo: Repository<ClientOrder>,
    @InjectRepository(ClientOrderLineItem)
    private readonly clientLineItemRepo: Repository<ClientOrderLineItem>,
    @InjectRepository(Supplier)
    private readonly supplierRepo: Repository<Supplier>,
    @InjectRepository(FactoryCode)
    private readonly factoryCodeRepo: Repository<FactoryCode>,
    private readonly emailService: EmailService,
    private readonly marketSettingsService: MarketSettingsService,
    private readonly gcs: GcsService,
  ) {}

  async list(
    market?: MarketCode,
    clientOrderId?: string,
  ): Promise<SupplierOrder[]> {
    const qb = this.supplierOrderRepo
      .createQueryBuilder("so")
      .leftJoinAndSelect("so.supplier", "supplier")
      .leftJoinAndSelect("so.clientOrder", "clientOrder")
      .leftJoinAndSelect("clientOrder.client", "client")
      .leftJoinAndSelect("so.lineItems", "lineItems")
      .orderBy("so.createdAt", "DESC");

    if (market) {
      qb.andWhere("client.country = :market", { market });
    }
    if (clientOrderId) {
      qb.andWhere("so.clientOrderId = :clientOrderId", { clientOrderId });
    }

    return qb.getMany();
  }

  async findById(id: string): Promise<SupplierOrder> {
    const order = await this.supplierOrderRepo.findOne({
      where: { id },
      relations: ["supplier", "clientOrder", "clientOrder.client", "lineItems", "invoices"],
    });
    if (!order) throw new NotFoundException("Pedido proveedor no encontrado");
    return order;
  }

  async getSupplierPreview(
    clientOrderId: string,
    user: User,
  ): Promise<SupplierPreviewResponse> {
    this.requireAdmin(user);

    const clientOrder = await this.clientOrderRepo.findOne({
      where: { id: clientOrderId },
      relations: ["lineItems", "client"],
    });
    if (!clientOrder) throw new NotFoundException("Pedido cliente no encontrado");

    this.assertClientOrderEligibleForPo(clientOrder);

    const { pendingLines, groups, unmappedSkus } =
      await this.buildSupplierGroups(clientOrder.lineItems);

    const existingSupplierOrders = await this.supplierOrderRepo.find({
      where: { clientOrderId },
      relations: ["supplier"],
      order: { createdAt: "DESC" },
    });

    return {
      clientOrder: {
        id: clientOrder.id,
        orderNumber: clientOrder.orderNumber,
        clientName: clientOrder.client?.name ?? clientOrder.client?.email ?? "—",
        status: clientOrder.status,
      },
      pendingLines,
      groups,
      unmappedSkus,
      existingSupplierOrders: existingSupplierOrders.map((po) => ({
        id: po.id,
        orderNumber: po.orderNumber,
        status: po.status,
        supplierName: po.supplier?.name ?? "—",
      })),
    };
  }

  async createFromClientOrder(
    clientOrderId: string,
    dto: CreateSupplierOrderFromClientOrderDto,
    user: User,
  ): Promise<SupplierOrder> {
    this.requireAdmin(user);

    return this.dataSource.transaction(async (manager) => {
      return this.createFromClientOrderInTransaction(manager, clientOrderId, dto);
    });
  }

  async generateAllFromClientOrder(
    clientOrderId: string,
    dto: GenerateAllSupplierOrdersDto,
    user: User,
  ): Promise<GenerateAllSupplierOrdersResult> {
    this.requireAdmin(user);

    return this.dataSource.transaction(async (manager) => {
      const clientOrderRepo = manager.getRepository(ClientOrder);
      const clientOrder = await clientOrderRepo.findOne({
        where: { id: clientOrderId },
        relations: ["lineItems", "client"],
      });
      if (!clientOrder) throw new NotFoundException("Pedido cliente no encontrado");

      this.assertClientOrderEligibleForPo(clientOrder);

      const { groups, unmappedSkus } = await this.buildSupplierGroups(
        clientOrder.lineItems,
      );

      const skipped = unmappedSkus.map((sku) => ({
        sku,
        reason: "Sin proveedor primario configurado",
      }));

      if (groups.length === 0) {
        throw new BadRequestException(
          skipped.length > 0
            ? "Ninguna línea tiene proveedor primario configurado"
            : "No hay líneas pendientes de envío a proveedor",
        );
      }

      const created: GenerateAllSupplierOrdersResult["created"] = [];

      for (const group of groups) {
        const po = await this.createFromClientOrderInTransaction(
          manager,
          clientOrderId,
          {
            supplierId: group.supplier.id,
            clientOrderLineItemIds: group.lines.map((l) => l.lineItemId),
            notes: dto.notes,
          },
        );
        created.push({
          id: po.id,
          orderNumber: po.orderNumber,
          supplierId: po.supplierId,
          status: po.status,
        });
      }

      return { created, skipped };
    });
  }

  async updateStatus(
    id: string,
    dto: UpdateSupplierOrderStatusDto,
    user: User,
  ): Promise<SupplierOrder> {
    this.requireAdmin(user);

    return this.dataSource.transaction(async (manager) => {
      const supplierOrderRepo = manager.getRepository(SupplierOrder);
      const clientLineItemRepo = manager.getRepository(ClientOrderLineItem);

      const order = await supplierOrderRepo.findOne({
        where: { id },
        relations: ["lineItems"],
      });
      if (!order) throw new NotFoundException("Pedido proveedor no encontrado");

      const previousStatus = order.status;
      order.status = dto.status;

      if (dto.status === SupplierOrderStatus.SENT) {
        order.sentAt = new Date();
      }

      if (
        dto.status === SupplierOrderStatus.CANCELLED &&
        previousStatus !== SupplierOrderStatus.CANCELLED
      ) {
        for (const line of order.lineItems) {
          if (!line.clientOrderLineItemId) continue;
          const clientLine = await clientLineItemRepo.findOneBy({
            id: line.clientOrderLineItemId,
          });
          if (!clientLine) continue;
          clientLine.quantitySentToSupplier = Math.max(
            0,
            clientLine.quantitySentToSupplier - line.quantity,
          );
          await clientLineItemRepo.save(clientLine);
        }
      }

      return supplierOrderRepo.save(order);
    });
  }

  async generatePdf(id: string): Promise<Buffer> {
    const order = await this.findById(id);
    const clientCountry = order.clientOrder?.client?.country ?? MarketCode.VE;
    const marketConfig = await this.marketSettingsService.getByCode(clientCountry);
    const currency = marketConfig.currency;

    return new Promise<Buffer>((resolve) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));

      doc.fontSize(20).text("PEDIDO A PROVEEDOR", { align: "center" });
      doc.moveDown();
      doc.fontSize(12);
      doc.text(`Número: ${order.orderNumber}`);
      doc.text(`Proveedor: ${order.supplier.name}`);
      if (order.supplier.documentNumber) {
        const labels: Record<string, string> = {
          dni: "DNI",
          nie: "NIE",
          nif: "NIF",
          cif: "CIF",
          cedula: "Cédula",
          rif: "RIF",
        };
        const docLabel =
          labels[order.supplier.documentType ?? ""] ??
          (order.supplier.documentType ?? "Doc").toUpperCase();
        doc.text(`${docLabel}: ${order.supplier.documentNumber}`);
      }
      const supplierEmails = [
        order.supplier.email,
        ...(order.supplier.emails ?? []),
      ].filter(Boolean);
      doc.text(`Email: ${supplierEmails.join(", ")}`);
      const supplierPhones = [
        order.supplier.phone,
        ...(order.supplier.phones ?? []),
      ].filter(Boolean);
      if (supplierPhones.length > 0) {
        doc.text(`Teléfono: ${supplierPhones.join(", ")}`);
      }
      doc.text(`Pedido cliente: ${order.clientOrder?.orderNumber ?? "—"}`);
      doc.text(`Fecha: ${new Date().toLocaleDateString("es-ES")}`);
      doc.moveDown();

      doc.fontSize(14).text("Artículos");
      doc.moveDown(0.3);
      for (const item of order.lineItems) {
        doc
          .fontSize(11)
          .text(
            `${item.factoryCode} | SKU: ${item.productSku} | Cant: ${item.quantity} ${item.unit || "UD"} × ${currency} ${Number(item.unitCost).toFixed(2)} = ${currency} ${Number(item.lineTotal).toFixed(2)}`,
          );
      }

      const total = order.lineItems.reduce((s, i) => s + Number(i.lineTotal), 0);
      doc.moveDown();
      doc
        .fontSize(14)
        .text(`TOTAL: ${currency} ${total.toFixed(2)}`, { align: "right" });
      doc.end();
    });
  }

  async sendEmail(id: string, user: User): Promise<{ sent: boolean }> {
    this.requireAdmin(user);

    const order = await this.findById(id);
    const pdfBuffer = await this.generatePdf(id);

    const recipientEmails = [
      order.supplier.email,
      ...(order.supplier.emails ?? []),
    ].filter(Boolean);

    const sent = await this.emailService.sendSupplierOrder(
      recipientEmails,
      order.supplier.name,
      order.orderNumber,
      pdfBuffer,
    );

    if (!sent) {
      throw new BadRequestException(
        "No se pudo enviar el email (BREVO_API_KEY no configurada)",
      );
    }

    order.status = SupplierOrderStatus.SENT;
    order.sentAt = new Date();
    await this.supplierOrderRepo.save(order);

    return { sent: true };
  }

  async createSupplierInvoice(
    dto: CreateSupplierInvoiceDto,
    user: User,
  ): Promise<SupplierInvoice> {
    this.requireAdmin(user);

    const order = await this.findById(dto.supplierOrderId);
    const invoice = this.supplierInvoiceRepo.create({
      ...dto,
      supplierId: order.supplierId,
      issueDate: new Date(dto.issueDate),
    });
    return this.supplierInvoiceRepo.save(invoice);
  }

  async listSupplierInvoices(market?: MarketCode): Promise<SupplierInvoice[]> {
    const qb = this.supplierInvoiceRepo
      .createQueryBuilder("si")
      .leftJoinAndSelect("si.supplier", "supplier")
      .leftJoinAndSelect("si.supplierOrder", "supplierOrder")
      .leftJoinAndSelect("supplierOrder.clientOrder", "clientOrder")
      .leftJoinAndSelect("clientOrder.client", "client")
      .orderBy("si.createdAt", "DESC");

    if (market) {
      qb.andWhere("client.country = :market", { market });
    }

    return qb.getMany();
  }

  async updateSupplierInvoiceStatus(
    id: string,
    dto: UpdateSupplierInvoiceStatusDto,
    user: User,
  ): Promise<SupplierInvoice> {
    this.requireAdmin(user);
    const invoice = await this.supplierInvoiceRepo.findOneBy({ id });
    if (!invoice) throw new NotFoundException("Factura proveedor no encontrada");
    invoice.status = dto.status;
    return this.supplierInvoiceRepo.save(invoice);
  }

  async getSupplierInvoiceFileUrl(
    id: string,
    user: User,
  ): Promise<{ url: string }> {
    this.requireAdmin(user);
    const invoice = await this.supplierInvoiceRepo.findOneBy({ id });
    if (!invoice) throw new NotFoundException("Factura proveedor no encontrada");
    if (!invoice.fileUrl) {
      throw new NotFoundException("Esta factura no tiene archivo adjunto");
    }
    if (!this.gcs.isConfigured()) {
      throw new BadRequestException("Google Cloud Storage no está configurado");
    }
    const url = await this.gcs.getSignedUrl("invoices", invoice.fileUrl, 60);
    return { url };
  }

  private requireAdmin(user: User): void {
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException("Solo administradores");
    }
  }

  private assertClientOrderEligibleForPo(clientOrder: ClientOrder): void {
    if (
      clientOrder.status === ClientOrderStatus.DRAFT ||
      clientOrder.status === ClientOrderStatus.CANCELLED
    ) {
      throw new BadRequestException(
        "No se pueden crear POs para pedidos en borrador o cancelados",
      );
    }
  }

  private assertSupplierMarket(
    supplier: Supplier,
    clientCountry: MarketCode,
  ): void {
    const supplierMarket = supplier.market ?? MarketCode.VE;
    if (supplierMarket !== clientCountry) {
      throw new BadRequestException(
        `El proveedor pertenece a ${supplierMarket} y el cliente a ${clientCountry}`,
      );
    }
  }

  private async buildSupplierGroups(lineItems: ClientOrderLineItem[]): Promise<{
    pendingLines: SupplierPreviewLine[];
    groups: SupplierPreviewGroup[];
    unmappedSkus: string[];
  }> {
    const pendingLines: SupplierPreviewLine[] = [];
    const groupsMap = new Map<string, SupplierPreviewGroup>();
    const unmappedSkus: string[] = [];

    for (const item of lineItems) {
      const quantityPending = item.quantityOrdered - item.quantitySentToSupplier;
      if (quantityPending <= 0) continue;

      const fc = await this.factoryCodeRepo.findOne({
        where: { productSku: item.productSku, isPrimary: true },
        relations: ["supplier"],
      });

      if (!fc?.supplier) {
        unmappedSkus.push(item.productSku);
        pendingLines.push({
          lineItemId: item.id,
          productSku: item.productSku,
          unit: item.unit,
          quantityPending,
          warning: "no_primary_supplier",
        });
        continue;
      }

      const line: SupplierPreviewLine = {
        lineItemId: item.id,
        productSku: item.productSku,
        unit: item.unit,
        quantityPending,
        primarySupplier: { id: fc.supplier.id, name: fc.supplier.name },
        factoryCode: fc.factoryCode,
        unitCost: Number(fc.factoryCost ?? 0),
      };
      pendingLines.push(line);

      const existing = groupsMap.get(fc.supplier.id);
      if (existing) {
        existing.lines.push(line);
        existing.estimatedTotal += line.unitCost! * quantityPending;
      } else {
        groupsMap.set(fc.supplier.id, {
          supplier: {
            id: fc.supplier.id,
            name: fc.supplier.name,
            email: fc.supplier.email,
            emails: fc.supplier.emails ?? [],
          },
          lines: [line],
          estimatedTotal: line.unitCost! * quantityPending,
        });
      }
    }

    return {
      pendingLines,
      groups: Array.from(groupsMap.values()),
      unmappedSkus: [...new Set(unmappedSkus)],
    };
  }

  private async resolveFactoryCode(
    productSku: string,
    supplierId: string,
    manager: EntityManager,
  ): Promise<FactoryCode | null> {
    const factoryCodeRepo = manager.getRepository(FactoryCode);
    const primary = await factoryCodeRepo.findOne({
      where: { productSku, supplierId, isPrimary: true },
    });
    if (primary) return primary;

    return factoryCodeRepo.findOne({
      where: { productSku, supplierId },
    });
  }

  private async createFromClientOrderInTransaction(
    manager: EntityManager,
    clientOrderId: string,
    dto: CreateSupplierOrderFromClientOrderDto,
  ): Promise<SupplierOrder> {
    const clientOrderRepo = manager.getRepository(ClientOrder);
    const supplierRepo = manager.getRepository(Supplier);
    const clientLineItemRepo = manager.getRepository(ClientOrderLineItem);
    const supplierOrderRepo = manager.getRepository(SupplierOrder);
    const lineItemRepo = manager.getRepository(SupplierOrderLineItem);

    const clientOrder = await clientOrderRepo.findOne({
      where: { id: clientOrderId },
      relations: ["lineItems", "client"],
    });
    if (!clientOrder) throw new NotFoundException("Pedido cliente no encontrado");

    this.assertClientOrderEligibleForPo(clientOrder);

    const supplier = await supplierRepo.findOneBy({ id: dto.supplierId });
    if (!supplier) throw new NotFoundException("Proveedor no encontrado");

    const clientCountry = (clientOrder.client?.country ?? MarketCode.VE) as MarketCode;
    this.assertSupplierMarket(supplier, clientCountry);

    const availableItems = clientOrder.lineItems.filter(
      (i) => i.quantitySentToSupplier < i.quantityOrdered,
    );

    let selectedItems = dto.clientOrderLineItemIds?.length
      ? availableItems.filter((i) => dto.clientOrderLineItemIds!.includes(i.id))
      : availableItems;

    const eligibleItems: ClientOrderLineItem[] = [];
    const skippedSkus: string[] = [];

    for (const item of selectedItems) {
      const fc = await this.resolveFactoryCode(item.productSku, dto.supplierId, manager);
      if (fc) {
        eligibleItems.push(item);
      } else {
        skippedSkus.push(item.productSku);
      }
    }

    selectedItems = eligibleItems;

    if (selectedItems.length === 0) {
      if (skippedSkus.length > 0) {
        throw new BadRequestException(
          `Ninguna línea pendiente tiene código de fábrica con ${supplier.name}. ` +
            `SKUs no asignables: ${[...new Set(skippedSkus)].join(", ")}. ` +
            `Configure códigos en Productos o use Generar POs en Pedidos Cliente.`,
        );
      }
      throw new BadRequestException("No hay líneas disponibles");
    }

    const lineItems: SupplierOrderLineItem[] = [];

    for (const item of selectedItems) {
      const fc = await this.resolveFactoryCode(item.productSku, dto.supplierId, manager);
      if (!fc) {
        throw new BadRequestException(
          `No hay código de fábrica para ${item.productSku} con ${supplier.name}`,
        );
      }

      const qty =
        Number(item.quantityOrdered) - Number(item.quantitySentToSupplier);
      lineItems.push(
        lineItemRepo.create({
          clientOrderLineItemId: item.id,
          productSku: item.productSku,
          factoryCode: fc.factoryCode,
          unit: normalizeUnit(item.unit),
          quantity: qty,
          unitCost: fc.factoryCost ?? 0,
        }),
      );

      item.quantitySentToSupplier += qty;
      await clientLineItemRepo.save(item);
    }

    const supplierOrder = supplierOrderRepo.create({
      supplierId: dto.supplierId,
      clientOrderId,
      notes: dto.notes ?? null,
      lineItems,
    });
    supplierOrder.orderNumber = await generateSequentialNumber(
      supplierOrderRepo,
      "orderNumber",
      "DKM-PO",
    );

    return supplierOrderRepo.save(supplierOrder);
  }
}
