import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ClientOrder, ClientOrderStatus } from "./entities/client-order.entity";
import { ClientOrderLineItem } from "./entities/client-order-line-item.entity";
import { Proposal, ProposalStatus, ProposalType } from "../proposals/proposal.entity";
import { MaterialList } from "../material-lists/material-list.entity";
import { User, UserRole } from "../users/user.entity";
import { CreateOrderFromProposalDto, UpdateOrderStatusDto } from "./orders.dto";
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
    @InjectRepository(Proposal)
    private readonly proposalRepo: Repository<Proposal>,
    @InjectRepository(MaterialList)
    private readonly materialRepo: Repository<MaterialList>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly marketSettingsService: MarketSettingsService,
  ) {}

  async list(filters?: {
    clientId?: string;
    status?: ClientOrderStatus;
    market?: MarketCode;
  }): Promise<ClientOrder[]> {
    const qb = this.orderRepo
      .createQueryBuilder("o")
      .leftJoinAndSelect("o.client", "client")
      .leftJoinAndSelect("o.lineItems", "lineItems")
      .leftJoinAndSelect("o.proposal", "proposal")
      .orderBy("o.createdAt", "DESC");

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
        order.internalNotes = null;
      }
    }

    return orders;
  }

  async findById(id: string, user: User): Promise<ClientOrder> {
    const order = await this.orderRepo.findOne({
      where: { id },
      relations: ["client", "lineItems", "proposal", "creator"],
    });
    if (!order) throw new NotFoundException("Pedido no encontrado");

    if (
      user.role !== UserRole.ADMIN &&
      order.clientId !== user.id
    ) {
      throw new ForbiddenException("Acceso denegado");
    }

    if (!Number.isFinite(Number(order.total))) {
      order.recalculateTotals();
      await this.orderRepo.save(order);
    }

    if (user.role !== UserRole.ADMIN) {
      order.internalNotes = null;
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
      throw new BadRequestException("Solo propuestas firmadas pueden convertirse en pedido");
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

    const materials = await this.materialRepo.find({ where: { proposalId } });
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

    const lineItems = selectedMaterials.map((m) => {
      const remaining =
        Number(m.quantity) - Number(m.orderedQuantity ?? 0);
      return this.lineItemRepo.create({
        productSku: m.productSku,
        unit: normalizeUnit(m.unit),
        quantityOrdered: remaining,
        unitPrice: m.suggestedPrice,
        discountPct: clampDiscountPct(m.discountPct),
        proposalMaterialListId: m.id,
      });
    });

    const order = this.orderRepo.create({
      proposalId,
      clientId,
      status: ClientOrderStatus.CONFIRMED,
      taxRate: dto.taxRate ?? defaultTaxRate,
      createdBy: user.id,
      externalNotes: dto.externalNotes?.trim() || null,
      internalNotes: dto.internalNotes?.trim() || null,
      lineItems,
    });
    order.orderNumber = await generateSequentialNumber(
      this.orderRepo,
      "orderNumber",
      "DKM-ORD",
    );
    order.recalculateTotals();

    const saved = await this.orderRepo.save(order);

    for (const m of selectedMaterials) {
      const remaining =
        Number(m.quantity) - Number(m.orderedQuantity ?? 0);
      m.orderedQuantity = Number(m.orderedQuantity ?? 0) + remaining;
      await this.materialRepo.save(m);
    }

    proposal.orderId = saved.id;
    await this.proposalRepo.save(proposal);

    return saved;
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

  async getLineItemsAvailableForSupplier(orderId: string): Promise<ClientOrderLineItem[]> {
    const items = await this.lineItemRepo.find({ where: { orderId } });
    return items.filter(
      (i) => i.quantitySentToSupplier < i.quantityOrdered,
    );
  }
}
