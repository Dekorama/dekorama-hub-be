import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { ClientOrder, ClientOrderStatus } from "./entities/client-order.entity";
import { ClientOrderLineItem } from "./entities/client-order-line-item.entity";
import { ClientOrderSection } from "./entities/client-order-section.entity";
import { Proposal, ProposalStatus, ProposalType } from "../proposals/proposal.entity";
import { MaterialList } from "../material-lists/material-list.entity";
import { Product } from "../products/product.entity";
import { User, UserRole } from "../users/user.entity";
import {
  CreateOrderFromProposalDto,
  UpdateOrderDto,
  UpdateOrderLineItemDto,
  UpdateOrderStatusDto,
} from "./orders.dto";
import { generateSequentialNumber } from "../common/generate-sequential-number";
import { MarketSettingsService } from "../admin/market-settings.service";
import { MarketCode } from "../common/market";
import {
  clampDiscountPct,
  normalizeUnit,
} from "../common/line-item.utils";

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(ClientOrder)
    private readonly orderRepo: Repository<ClientOrder>,
    @InjectRepository(ClientOrderLineItem)
    private readonly lineItemRepo: Repository<ClientOrderLineItem>,
    @InjectRepository(ClientOrderSection)
    private readonly sectionRepo: Repository<ClientOrderSection>,
    @InjectRepository(Proposal)
    private readonly proposalRepo: Repository<Proposal>,
    @InjectRepository(MaterialList)
    private readonly materialRepo: Repository<MaterialList>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly marketSettingsService: MarketSettingsService,
  ) {}

  private stripInternalForClient(order: ClientOrder): void {
    order.internalNotes = null;
    if (order.lineItems?.length) {
      for (const li of order.lineItems) {
        li.internalComment = null;
      }
    }
  }

  async list(filters?: {
    clientId?: string;
    status?: ClientOrderStatus;
    market?: MarketCode;
  }): Promise<ClientOrder[]> {
    const qb = this.orderRepo
      .createQueryBuilder("o")
      .leftJoinAndSelect("o.client", "client")
      .leftJoinAndSelect("o.lineItems", "lineItems")
      .leftJoinAndSelect("o.sections", "sections")
      .leftJoinAndSelect("o.proposal", "proposal")
      .orderBy("o.createdAt", "DESC")
      .addOrderBy("sections.sortOrder", "ASC");

    if (filters?.clientId) {
      qb.andWhere("o.clientId = :clientId", { clientId: filters.clientId });
    }
    if (filters?.status) {
      qb.andWhere("o.status = :status", { status: filters.status });
    }
    if (filters?.market) {
      qb.andWhere("client.country = :market", { market: filters.market });
    }
    const orders = await qb.getMany();

    for (const order of orders) {
      if (!Number.isFinite(Number(order.total))) {
        order.recalculateTotals();
        await this.orderRepo.save(order);
      }
      if (filters?.clientId) {
        this.stripInternalForClient(order);
      }
    }

    return orders;
  }

  async findById(id: string, user: User): Promise<ClientOrder> {
    const order = await this.orderRepo.findOne({
      where: { id },
      relations: ["client", "lineItems", "sections", "proposal", "creator"],
    });
    if (!order) throw new NotFoundException("Pedido no encontrado");

    if (user.role !== UserRole.ADMIN && order.clientId !== user.id) {
      throw new ForbiddenException("Acceso denegado");
    }

    if (!Number.isFinite(Number(order.total))) {
      order.recalculateTotals();
      await this.orderRepo.save(order);
    }

    if (order.sections?.length) {
      order.sections.sort((a, b) => a.sortOrder - b.sortOrder);
    }

    if (user.role !== UserRole.ADMIN) {
      this.stripInternalForClient(order);
    }

    return order;
  }

  async createFromProposal(
    proposalId: string,
    dto: CreateOrderFromProposalDto,
    user: User,
  ): Promise<ClientOrder> {
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException("Solo administradores");
    }

    const proposal = await this.proposalRepo.findOne({
      where: { id: proposalId },
      relations: ["project"],
    });
    if (!proposal) throw new NotFoundException("Propuesta no encontrada");

    const isManualDirectSale = proposal.type === ProposalType.DIRECT_SALE;
    const allowedWithoutSign = [
      ProposalStatus.PENDING,
      ProposalStatus.PROFORMA_READY,
      ProposalStatus.SIGNED,
    ];
    if (isManualDirectSale) {
      if (!allowedWithoutSign.includes(proposal.status)) {
        throw new BadRequestException("Estado inválido para convertir a pedido");
      }
    } else if (proposal.status !== ProposalStatus.SIGNED) {
      throw new BadRequestException(
        "Solo propuestas firmadas pueden convertirse en pedido",
      );
    }

    const clientId = proposal.clientId ?? proposal.project?.clientId;
    if (!clientId) throw new BadRequestException("Propuesta sin cliente");

    const client = await this.userRepo.findOneBy({ id: clientId });
    if (!client) throw new BadRequestException("Cliente no encontrado");

    const defaultTaxRate =
      proposal.taxRate !== undefined && proposal.taxRate !== null
        ? Number(proposal.taxRate)
        : client.taxExempt
          ? 0
          : client.taxRate !== undefined && client.taxRate !== null
            ? Number(client.taxRate)
            : await this.marketSettingsService.getDefaultTaxRate(client.country);

    const materials = await this.materialRepo.find({
      where: { proposalId },
      relations: ["section"],
    });
    if (materials.length === 0) {
      throw new BadRequestException("La propuesta no tiene materiales");
    }

    const remainingMaterials = materials.filter(
      (m) => Number(m.orderedQuantity ?? 0) < Number(m.quantity),
    );

    const selectedMaterials = dto.materialListIds?.length
      ? remainingMaterials.filter((m) => dto.materialListIds!.includes(m.id))
      : remainingMaterials;

    if (selectedMaterials.length === 0) {
      throw new BadRequestException(
        "No hay líneas pendientes para convertir a pedido",
      );
    }

    const order = this.orderRepo.create({
      proposalId,
      clientId,
      status: ClientOrderStatus.CONFIRMED,
      taxRate: dto.taxRate ?? defaultTaxRate,
      createdBy: user.id,
      externalNotes: dto.externalNotes?.trim() || null,
      internalNotes: dto.internalNotes?.trim() || null,
      lineItems: [],
    });
    order.orderNumber = await generateSequentialNumber(
      this.orderRepo,
      "orderNumber",
      "DKM-ORD",
    );

    const savedOrder = await this.orderRepo.save(order);

    const sectionKeyToId = new Map<string, string>();
    const sectionMetas: Array<{ key: string; name: string; sortOrder: number }> =
      [];

    for (const m of selectedMaterials) {
      if (!m.sectionId || !m.section) continue;
      const key = m.sectionId;
      if (sectionKeyToId.has(key)) continue;
      sectionMetas.push({
        key,
        name: m.section.name,
        sortOrder: m.section.sortOrder,
      });
      sectionKeyToId.set(key, "");
    }

    sectionMetas.sort((a, b) => a.sortOrder - b.sortOrder);
    for (let i = 0; i < sectionMetas.length; i++) {
      const meta = sectionMetas[i];
      const section = await this.sectionRepo.save(
        this.sectionRepo.create({
          orderId: savedOrder.id,
          name: meta.name,
          sortOrder: i,
        }),
      );
      sectionKeyToId.set(meta.key, section.id);
    }

    const lineItems = selectedMaterials.map((m) => {
      const remaining = Number(m.quantity) - Number(m.orderedQuantity ?? 0);
      return this.lineItemRepo.create({
        orderId: savedOrder.id,
        productSku: m.productSku,
        unit: normalizeUnit(m.unit),
        quantityOrdered: remaining,
        unitPrice: m.suggestedPrice,
        discountPct: clampDiscountPct(m.discountPct),
        proposalMaterialListId: m.id,
        sectionId: m.sectionId ? (sectionKeyToId.get(m.sectionId) ?? null) : null,
        externalComment: m.externalComment?.trim() || null,
        internalComment: m.internalComment?.trim() || null,
      });
    });

    await this.lineItemRepo.save(lineItems);

    for (const m of selectedMaterials) {
      const remaining = Number(m.quantity) - Number(m.orderedQuantity ?? 0);
      m.orderedQuantity = Number(m.orderedQuantity ?? 0) + remaining;
      await this.materialRepo.save(m);
    }

    proposal.orderId = savedOrder.id;
    await this.proposalRepo.save(proposal);

    return this.findById(savedOrder.id, user);
  }

  async update(id: string, dto: UpdateOrderDto, user: User): Promise<ClientOrder> {
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException("Solo administradores");
    }

    const order = await this.orderRepo.findOne({
      where: { id },
      relations: ["lineItems", "sections"],
    });
    if (!order) throw new NotFoundException("Pedido no encontrado");

    if (order.status === ClientOrderStatus.CANCELLED) {
      throw new BadRequestException("No se puede editar un pedido cancelado");
    }

    if (dto.externalNotes !== undefined) {
      order.externalNotes = dto.externalNotes?.trim() || null;
    }
    if (dto.internalNotes !== undefined) {
      order.internalNotes = dto.internalNotes?.trim() || null;
    }
    if (dto.taxRate !== undefined) {
      order.taxRate = dto.taxRate;
    }

    const hasLineUpdate =
      dto.sections !== undefined || dto.lineItems !== undefined;

    if (hasLineUpdate) {
      await this.replaceSectionsAndLineItems(order, dto);
    }

    order.recalculateTotals();
    await this.orderRepo.save(order);

    return this.findById(id, user);
  }

  private async replaceSectionsAndLineItems(
    order: ClientOrder,
    dto: UpdateOrderDto,
  ): Promise<void> {
    const existingById = new Map(
      (order.lineItems ?? []).map((li) => [li.id, li]),
    );

    type FlatLine = UpdateOrderLineItemDto & { sectionName?: string | null; sectionSort?: number };
    const flat: FlatLine[] = [];

    if (dto.sections?.length) {
      for (let i = 0; i < dto.sections.length; i++) {
        const section = dto.sections[i];
        for (const li of section.lineItems ?? []) {
          flat.push({
            ...li,
            sectionName: section.name,
            sectionSort: section.sortOrder ?? i,
          });
        }
      }
    } else if (dto.lineItems?.length) {
      for (const li of dto.lineItems) {
        flat.push({ ...li, sectionName: null, sectionSort: 0 });
      }
    }

    for (const li of flat) {
      if (li.id && existingById.has(li.id)) {
        const existing = existingById.get(li.id)!;
        const minQty = Math.max(
          Number(existing.quantitySentToSupplier) || 0,
          Number(existing.quantityInvoiced) || 0,
          Number(existing.quantityFulfilled) || 0,
        );
        if (Number(li.quantityOrdered) < minQty) {
          throw new BadRequestException(
            `Cantidad de ${li.productSku} no puede ser menor a ${minQty} (ya enviado/facturado)`,
          );
        }
      }
    }

    const previousByMaterialId = new Map<string, number>();
    for (const li of order.lineItems ?? []) {
      if (li.proposalMaterialListId) {
        previousByMaterialId.set(
          li.proposalMaterialListId,
          Number(li.quantityOrdered),
        );
      }
    }

    await this.lineItemRepo.delete({ orderId: order.id });
    await this.sectionRepo.delete({ orderId: order.id });

    const sectionNameToId = new Map<string, string>();
    if (dto.sections?.length) {
      for (let i = 0; i < dto.sections.length; i++) {
        const s = dto.sections[i];
        const saved = await this.sectionRepo.save(
          this.sectionRepo.create({
            orderId: order.id,
            name: s.name,
            sortOrder: s.sortOrder ?? i,
          }),
        );
        sectionNameToId.set(`${s.name}::${s.sortOrder ?? i}`, saved.id);
      }
    }

    const newLines: ClientOrderLineItem[] = [];
    for (const li of flat) {
      let productName = li.productName;
      let unit = li.unit;
      if (!productName || !unit) {
        const product = await this.productRepo.findOne({
          where: { sku: li.productSku },
        });
        if (!product && !productName) {
          throw new NotFoundException(`Producto ${li.productSku} no encontrado`);
        }
        productName = productName ?? product!.name;
        unit = unit ?? product?.unit ?? "unidad";
      }

      const existing = li.id ? existingById.get(li.id) : undefined;
      const sectionKey =
        li.sectionName != null
          ? `${li.sectionName}::${li.sectionSort ?? 0}`
          : null;

      const created = this.lineItemRepo.create({
        orderId: order.id,
        productSku: li.productSku,
        unit: normalizeUnit(unit),
        quantityOrdered: li.quantityOrdered,
        quantityFulfilled: existing ? Number(existing.quantityFulfilled) : 0,
        quantityInvoiced: existing ? Number(existing.quantityInvoiced) : 0,
        quantitySentToSupplier: existing
          ? Number(existing.quantitySentToSupplier)
          : 0,
        unitPrice: li.unitPrice,
        discountPct: clampDiscountPct(li.discountPct),
        proposalMaterialListId:
          li.proposalMaterialListId ??
          existing?.proposalMaterialListId ??
          null,
        sectionId: sectionKey ? (sectionNameToId.get(sectionKey) ?? null) : null,
        externalComment: li.externalComment?.trim() || null,
        internalComment: li.internalComment?.trim() || null,
      });
      newLines.push(created);
    }

    const savedLines = await this.lineItemRepo.save(newLines);
    order.lineItems = savedLines;

    await this.syncProposalOrderedQuantities(previousByMaterialId, savedLines);
  }

  private async syncProposalOrderedQuantities(
    previousByMaterialId: Map<string, number>,
    newLines: ClientOrderLineItem[],
  ): Promise<void> {
    const newByMaterialId = new Map<string, number>();
    for (const li of newLines) {
      if (!li.proposalMaterialListId) continue;
      const prev = newByMaterialId.get(li.proposalMaterialListId) ?? 0;
      newByMaterialId.set(
        li.proposalMaterialListId,
        prev + Number(li.quantityOrdered),
      );
    }

    const allMaterialIds = new Set([
      ...previousByMaterialId.keys(),
      ...newByMaterialId.keys(),
    ]);
    if (allMaterialIds.size === 0) return;

    const materials = await this.materialRepo.find({
      where: { id: In([...allMaterialIds]) },
    });

    for (const m of materials) {
      const oldQty = previousByMaterialId.get(m.id) ?? 0;
      const newQty = newByMaterialId.get(m.id) ?? 0;
      const delta = newQty - oldQty;
      if (delta === 0) continue;
      m.orderedQuantity = Math.max(0, Number(m.orderedQuantity ?? 0) + delta);
      await this.materialRepo.save(m);
    }
  }

  async updateStatus(
    id: string,
    dto: UpdateOrderStatusDto,
    user: User,
  ): Promise<ClientOrder> {
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException("Solo administradores");
    }
    const order = await this.findById(id, user);
    order.status = dto.status;
    return this.orderRepo.save(order);
  }

  async getLineItemsAvailableForSupplier(
    orderId: string,
  ): Promise<ClientOrderLineItem[]> {
    const items = await this.lineItemRepo.find({ where: { orderId } });
    return items.filter((i) => i.quantitySentToSupplier < i.quantityOrdered);
  }
}
