import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Invoice, InvoiceStatus } from "./entities/invoice.entity";
import { InvoiceLineItem } from "./entities/invoice-line-item.entity";
import { Proposal, ProposalStatus } from "../proposals/proposal.entity";
import { User } from "../users/user.entity";
import { MaterialList } from "../material-lists/material-list.entity";
import {
  CreateInvoiceFromProposalDto,
  CreateInvoiceFromOrderDto,
  CreateManualInvoiceDto,
  UpdateInvoiceDto,
  UpdateInvoiceStatusDto,
  InvoiceResponseDto,
} from "./dto/invoice.dto";
import { ClientOrder } from "../orders/entities/client-order.entity";
import { ClientOrderLineItem } from "../orders/entities/client-order-line-item.entity";
import { generateInvoicePdfBuffer } from "./invoice-pdf.template";
import { generateSequentialNumber } from "../common/generate-sequential-number";
import { MarketSettingsService } from "../admin/market-settings.service";
import { MarketCode } from "../common/market";
import { GcsService } from "../gcs/gcs.service";

@Injectable()
export class InvoicesService {
  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(InvoiceLineItem)
    private readonly lineItemRepo: Repository<InvoiceLineItem>,
    @InjectRepository(Proposal)
    private readonly proposalRepo: Repository<Proposal>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(MaterialList)
    private readonly materialListRepo: Repository<MaterialList>,
    @InjectRepository(ClientOrder)
    private readonly orderRepo: Repository<ClientOrder>,
    @InjectRepository(ClientOrderLineItem)
    private readonly orderLineItemRepo: Repository<ClientOrderLineItem>,
    private readonly marketSettingsService: MarketSettingsService,
    private readonly gcs: GcsService,
  ) {}

  private async resolveTaxRate(
    clientId: string,
    providedRate?: number,
  ): Promise<number> {
    if (providedRate !== undefined && providedRate !== null) {
      return providedRate;
    }
    const client = await this.userRepo.findOneBy({ id: clientId });
    if (!client) return 16;
    if (client.taxExempt) return 0;
    if (client.taxRate !== undefined && client.taxRate !== null) {
      return Number(client.taxRate);
    }
    return this.marketSettingsService.getDefaultTaxRate(client.country);
  }

  private async assignInvoiceNumber(invoice: Invoice): Promise<void> {
    invoice.invoiceNumber = await generateSequentialNumber(
      this.invoiceRepo,
      "invoiceNumber",
      "DKM-INV",
    );
  }

  async list(filters?: {
    status?: InvoiceStatus;
    clientId?: string;
    startDate?: string;
    endDate?: string;
    market?: MarketCode;
  }): Promise<InvoiceResponseDto[]> {
    const queryBuilder = this.invoiceRepo
      .createQueryBuilder("invoice")
      .leftJoinAndSelect("invoice.client", "client")
      .leftJoinAndSelect("invoice.creator", "creator")
      .leftJoinAndSelect("invoice.lineItems", "lineItems")
      .orderBy("invoice.createdAt", "DESC");

    if (filters?.status) {
      queryBuilder.andWhere("invoice.status = :status", { status: filters.status });
    }

    if (filters?.clientId) {
      queryBuilder.andWhere("invoice.clientId = :clientId", { clientId: filters.clientId });
    }

    if (filters?.market) {
      queryBuilder.andWhere("client.country = :market", { market: filters.market });
    }

    if (filters?.startDate) {
      queryBuilder.andWhere("invoice.issueDate >= :startDate", { startDate: filters.startDate });
    }

    if (filters?.endDate) {
      queryBuilder.andWhere("invoice.issueDate <= :endDate", { endDate: filters.endDate });
    }

    const invoices = await queryBuilder.getMany();

    return invoices.map((invoice) => this.toResponseDto(invoice));
  }

  async findById(id: string): Promise<InvoiceResponseDto> {
    const invoice = await this.invoiceRepo.findOne({
      where: { id },
      relations: ["client", "creator", "lineItems", "proposal"],
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice with ID ${id} not found`);
    }

    return this.toResponseDto(invoice);
  }

  async createFromProposal(
    dto: CreateInvoiceFromProposalDto,
    adminId: string,
  ): Promise<InvoiceResponseDto> {
    // Verify proposal exists and is signed
    const proposal = await this.proposalRepo.findOne({
      where: { id: dto.proposalId },
      relations: ["project"],
    });

    if (!proposal) {
      throw new NotFoundException(`Proposal with ID ${dto.proposalId} not found`);
    }

    if (proposal.status !== ProposalStatus.SIGNED) {
      throw new BadRequestException(
        "Only signed proposals can be converted to invoices",
      );
    }

    // Get client from project or direct clientId
    const clientId = proposal.clientId ?? proposal.project?.clientId;
    if (!clientId) {
      throw new BadRequestException("Propuesta sin cliente asociado");
    }

    // Get materials from proposal
    const materials = await this.materialListRepo.find({
      where: { proposalId: dto.proposalId },
    });

    // Create invoice with line items
    const taxRate = await this.resolveTaxRate(clientId, dto.taxRate);
    const invoice = this.invoiceRepo.create({
      proposalId: dto.proposalId,
      clientId,
      issueDate: new Date(dto.issueDate),
      dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      taxRate,
      notes: dto.notes,
      createdBy: adminId,
      status: InvoiceStatus.DRAFT,
    });

    // Create line items
    const lineItems: InvoiceLineItem[] = [];

    // Add labor cost as first line item
    lineItems.push(
      this.lineItemRepo.create({
        description: "Mano de obra",
        quantity: 1,
        unitPrice: Number(proposal.laborCost),
      }),
    );

    // Add materials as line items
    for (const material of materials) {
      lineItems.push(
        this.lineItemRepo.create({
          description: material.productName,
          productSku: material.productSku,
          quantity: material.quantity,
          unitPrice: Number(material.suggestedPrice),
        }),
      );
    }

    invoice.lineItems = lineItems;

    await this.assignInvoiceNumber(invoice);
    const savedInvoice = await this.invoiceRepo.save(invoice);

    return this.findById(savedInvoice.id);
  }

  async createFromOrder(
    dto: CreateInvoiceFromOrderDto,
    adminId: string,
  ): Promise<InvoiceResponseDto> {
    const order = await this.orderRepo.findOne({
      where: { id: dto.orderId },
      relations: ["lineItems", "client"],
    });
    if (!order) throw new NotFoundException("Pedido no encontrado");

    const availableItems = order.lineItems.filter(
      (i) => i.quantityInvoiced < i.quantityOrdered,
    );

    const selectedItems = dto.orderLineItemIds?.length
      ? availableItems.filter((i) => dto.orderLineItemIds!.includes(i.id))
      : availableItems;

    if (selectedItems.length === 0) {
      throw new BadRequestException("No hay líneas disponibles para facturar");
    }

    const taxRate = await this.resolveTaxRate(order.clientId, dto.taxRate);
    const invoice = this.invoiceRepo.create({
      orderId: dto.orderId,
      proposalId: order.proposalId,
      clientId: order.clientId,
      issueDate: new Date(dto.issueDate),
      dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      taxRate,
      notes: dto.notes,
      createdBy: adminId,
      status: InvoiceStatus.DRAFT,
    });

    const lineItems: InvoiceLineItem[] = [];

    for (const item of selectedItems) {
      const qtyToInvoice = item.quantityOrdered - item.quantityInvoiced;
      lineItems.push(
        this.lineItemRepo.create({
          description: item.productSku,
          productSku: item.productSku,
          orderLineItemId: item.id,
          quantity: qtyToInvoice,
          unitPrice: Number(item.unitPrice),
        }),
      );
      item.quantityInvoiced += qtyToInvoice;
      await this.orderLineItemRepo.save(item);
    }

    invoice.lineItems = lineItems;
    await this.assignInvoiceNumber(invoice);
    const savedInvoice = await this.invoiceRepo.save(invoice);
    return this.findById(savedInvoice.id);
  }

  async createManual(
    dto: CreateManualInvoiceDto,
    adminId: string,
  ): Promise<InvoiceResponseDto> {
    // Verify client exists
    const client = await this.userRepo.findOne({ where: { id: dto.clientId } });
    if (!client) {
      throw new NotFoundException(`Client with ID ${dto.clientId} not found`);
    }

    // Create invoice
    const taxRate = await this.resolveTaxRate(dto.clientId, dto.taxRate);
    const invoice = this.invoiceRepo.create({
      clientId: dto.clientId,
      issueDate: new Date(dto.issueDate),
      dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      taxRate,
      notes: dto.notes,
      createdBy: adminId,
      status: InvoiceStatus.DRAFT,
    });

    // Create line items
    invoice.lineItems = dto.lineItems.map((item) =>
      this.lineItemRepo.create({
        description: item.description,
        productSku: item.productSku,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      }),
    );

    await this.assignInvoiceNumber(invoice);
    const savedInvoice = await this.invoiceRepo.save(invoice);

    return this.findById(savedInvoice.id);
  }

  async update(
    id: string,
    dto: UpdateInvoiceDto,
    adminId: string,
  ): Promise<InvoiceResponseDto> {
    const invoice = await this.invoiceRepo.findOne({
      where: { id },
      relations: ["lineItems"],
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice with ID ${id} not found`);
    }

    // Only draft invoices can be edited
    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw new BadRequestException("Only draft invoices can be edited");
    }

    // Update invoice fields
    if (dto.issueDate) {
      invoice.issueDate = new Date(dto.issueDate);
    }
    if (dto.dueDate !== undefined) {
      invoice.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    }
    if (dto.taxRate !== undefined) {
      invoice.taxRate = dto.taxRate;
    }
    if (dto.notes !== undefined) {
      invoice.notes = dto.notes;
    }

    // Update line items if provided
    if (dto.lineItems) {
      // Remove old line items
      await this.lineItemRepo.delete({ invoiceId: id });

      // Create new line items
      invoice.lineItems = dto.lineItems.map((item) =>
        this.lineItemRepo.create({
          invoiceId: id,
          description: item.description,
          productSku: item.productSku,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        }),
      );
    }

    const savedInvoice = await this.invoiceRepo.save(invoice);

    return this.findById(savedInvoice.id);
  }

  async updateStatus(
    id: string,
    dto: UpdateInvoiceStatusDto,
    adminId: string,
  ): Promise<InvoiceResponseDto> {
    const invoice = await this.invoiceRepo.findOne({ where: { id } });

    if (!invoice) {
      throw new NotFoundException(`Invoice with ID ${id} not found`);
    }

    invoice.status = dto.status;

    await this.invoiceRepo.save(invoice);

    return this.findById(id);
  }

  async delete(id: string, adminId: string): Promise<void> {
    const invoice = await this.invoiceRepo.findOne({ where: { id } });

    if (!invoice) {
      throw new NotFoundException(`Invoice with ID ${id} not found`);
    }

    // Only draft invoices can be deleted
    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw new BadRequestException("Only draft invoices can be deleted");
    }

    await this.invoiceRepo.delete(id);
  }

  async generatePdf(id: string): Promise<Buffer> {
    const invoice = await this.invoiceRepo.findOne({
      where: { id },
      relations: ["client", "lineItems", "proposal", "creator"],
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice with ID ${id} not found`);
    }

    if (
      invoice.pdfUrl &&
      this.gcs.isConfigured() &&
      (await this.gcs.exists("invoices", invoice.pdfUrl))
    ) {
      return this.gcs.downloadBuffer("invoices", invoice.pdfUrl);
    }

    const buffer = await generateInvoicePdfBuffer(invoice);

    if (this.gcs.isConfigured()) {
      try {
        const { objectPath } = await this.gcs.uploadClientInvoicePdf(
          invoice.invoiceNumber,
          buffer,
        );
        invoice.pdfUrl = objectPath;
        await this.invoiceRepo.save(invoice);
      } catch {
        // PDF still returned even if GCS upload fails
      }
    }

    return buffer;
  }

  private toResponseDto(invoice: Invoice): InvoiceResponseDto {
    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      proposalId: invoice.proposalId,
      clientId: invoice.clientId,
      clientName: (invoice.client as { name?: string } | undefined)?.name,
      clientEmail: invoice.client?.email,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      subtotal: Number(invoice.subtotal),
      taxRate: Number(invoice.taxRate),
      taxAmount: Number(invoice.taxAmount),
      total: Number(invoice.total),
      status: invoice.status,
      notes: invoice.notes,
      pdfUrl: invoice.pdfUrl,
      createdBy: invoice.createdBy,
      createdByName: (invoice.creator as { name?: string } | undefined)?.name,
      lineItems: invoice.lineItems.map((item) => ({
        id: item.id,
        description: item.description,
        productSku: item.productSku,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        lineTotal: Number(item.lineTotal),
      })),
      createdAt: invoice.createdAt,
      updatedAt: invoice.updatedAt,
    };
  }
}
