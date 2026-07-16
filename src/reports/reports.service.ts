import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Invoice, InvoiceStatus } from "../invoices/entities/invoice.entity";
import { ClientOrder, ClientOrderStatus } from "../orders/entities/client-order.entity";
import { Proposal, ProposalStatus, ProposalType } from "../proposals/proposal.entity";
import {
  SupplierOrder,
  SupplierOrderStatus,
} from "../supplier-orders/entities/supplier-order.entity";
import { ClientOrderLineItem } from "../orders/entities/client-order-line-item.entity";
import { User, UserRole } from "../users/user.entity";
import { Project, ProjectStatus } from "../projects/project.entity";
import { Product } from "../products/product.entity";
import { Supplier } from "../suppliers/entities/supplier.entity";
import { MarketCode } from "../common/market";

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(ClientOrder)
    private readonly orderRepo: Repository<ClientOrder>,
    @InjectRepository(Proposal)
    private readonly proposalRepo: Repository<Proposal>,
    @InjectRepository(SupplierOrder)
    private readonly supplierOrderRepo: Repository<SupplierOrder>,
    @InjectRepository(ClientOrderLineItem)
    private readonly lineItemRepo: Repository<ClientOrderLineItem>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(Supplier)
    private readonly supplierRepo: Repository<Supplier>,
  ) {}

  async getDashboard(market?: MarketCode) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const monthlySalesQb = this.invoiceRepo
      .createQueryBuilder("i")
      .leftJoin("i.client", "client")
      .select("COALESCE(SUM(i.total), 0)", "total")
      .where("i.status = :status", { status: InvoiceStatus.PAID })
      .andWhere("i.issueDate >= :start", { start: startOfMonth });
    if (market) monthlySalesQb.andWhere("client.country = :market", { market });
    const monthlySales = await monthlySalesQb.getRawOne<{ total: string }>();

    const ytdSalesQb = this.invoiceRepo
      .createQueryBuilder("i")
      .leftJoin("i.client", "client")
      .select("COALESCE(SUM(i.total), 0)", "total")
      .where("i.status = :status", { status: InvoiceStatus.PAID })
      .andWhere("i.issueDate >= :start", { start: startOfYear });
    if (market) ytdSalesQb.andWhere("client.country = :market", { market });
    const ytdSales = await ytdSalesQb.getRawOne<{ total: string }>();

    const pendingCollectionQb = this.invoiceRepo
      .createQueryBuilder("i")
      .leftJoin("i.client", "client")
      .select("COALESCE(SUM(i.total), 0)", "total")
      .addSelect("COUNT(i.id)", "count")
      .where("i.status = :status", { status: InvoiceStatus.ISSUED });
    if (market) pendingCollectionQb.andWhere("client.country = :market", { market });
    const pendingCollection = await pendingCollectionQb.getRawOne<{
      total: string;
      count: string;
    }>();

    const openOrdersQb = this.orderRepo
      .createQueryBuilder("o")
      .leftJoin("o.client", "client")
      .where("o.status IN (:...statuses)", {
        statuses: [ClientOrderStatus.CONFIRMED, ClientOrderStatus.PARTIAL],
      });
    if (market) openOrdersQb.andWhere("client.country = :market", { market });
    const openOrders = await openOrdersQb.getCount();

    const totalOrdersQb = this.orderRepo
      .createQueryBuilder("o")
      .leftJoin("o.client", "client");
    if (market) totalOrdersQb.andWhere("client.country = :market", { market });
    const totalOrders = await totalOrdersQb.getCount();

    const pendingSolicitudesQb = this.proposalRepo
      .createQueryBuilder("p")
      .leftJoin("p.client", "client")
      .where("p.status = :status", { status: ProposalStatus.SOLICITUD_SUBMITTED });
    if (market) pendingSolicitudesQb.andWhere("client.country = :market", { market });
    const pendingSolicitudes = await pendingSolicitudesQb.getCount();

    const openProposalsQb = this.proposalRepo
      .createQueryBuilder("p")
      .leftJoin("p.client", "client")
      .where("p.status = :status", { status: ProposalStatus.PENDING });
    if (market) openProposalsQb.andWhere("client.country = :market", { market });
    const openProposals = await openProposalsQb.getCount();

    const projectsBase = this.projectRepo
      .createQueryBuilder("project")
      .leftJoin("project.client", "client");
    if (market) projectsBase.andWhere("client.country = :market", { market });

    const totalProjects = await projectsBase.clone().getCount();
    const openProjects = await projectsBase
      .clone()
      .andWhere("project.status = :status", { status: ProjectStatus.OPEN })
      .getCount();
    const inProgressProjects = await projectsBase
      .clone()
      .andWhere("project.status = :status", { status: ProjectStatus.IN_PROGRESS })
      .getCount();
    const publicProjects = await projectsBase
      .clone()
      .andWhere("project.isPublic = :isPublic", { isPublic: true })
      .getCount();

    const userWhere = market ? { country: market } : {};
    const clients = await this.userRepo.count({
      where: { ...userWhere, role: UserRole.CLIENT },
    });
    const professionals = await this.userRepo.count({
      where: { ...userWhere, role: UserRole.PROFESSIONAL, isVerified: true },
    });
    const pendingVerification = await this.userRepo.count({
      where: { ...userWhere, role: UserRole.PROFESSIONAL, isVerified: false },
    });

    const productWhere = market
      ? { market, isActive: true }
      : { isActive: true };
    const activeProducts = await this.productRepo.count({ where: productWhere });

    const supplierWhere = market ? { market } : {};
    const suppliers = await this.supplierRepo.count({ where: supplierWhere });

    const supplierOrdersQb = this.supplierOrderRepo
      .createQueryBuilder("so")
      .leftJoin("so.clientOrder", "co")
      .leftJoin("co.client", "client")
      .where("so.status IN (:...statuses)", {
        statuses: [SupplierOrderStatus.DRAFT, SupplierOrderStatus.SENT],
      });
    if (market) supplierOrdersQb.andWhere("client.country = :market", { market });
    const pendingSupplierOrders = await supplierOrdersQb.getCount();

    const topProductsQb = this.lineItemRepo
      .createQueryBuilder("li")
      .leftJoin("li.order", "o")
      .leftJoin("o.client", "client")
      .select("li.productSku", "sku")
      .addSelect("SUM(li.quantityOrdered)", "totalSold")
      .addSelect("SUM(li.lineTotal)", "totalRevenue")
      .groupBy("li.productSku")
      .orderBy('"totalSold"', "DESC")
      .limit(5);
    if (market) topProductsQb.andWhere("client.country = :market", { market });
    const topProducts = await topProductsQb.getRawMany();

    const conversion = await this.getConversionReport(market);

    const monthlySalesNum = Number(monthlySales?.total ?? 0);
    const ytdSalesNum = Number(ytdSales?.total ?? 0);

    return {
      monthlySales: monthlySalesNum,
      openOrders,
      pendingSolicitudes,
      topProducts,
      sales: {
        monthly: monthlySalesNum,
        ytd: ytdSalesNum,
        pendingCollection: Number(pendingCollection?.total ?? 0),
        pendingInvoices: Number(pendingCollection?.count ?? 0),
      },
      orders: {
        open: openOrders,
        total: totalOrders,
      },
      proposals: {
        pendingSolicitudes,
        open: openProposals,
      },
      projects: {
        total: totalProjects,
        open: openProjects,
        inProgress: inProgressProjects,
        public: publicProjects,
      },
      users: {
        clients,
        professionals,
        pendingVerification,
      },
      catalog: {
        activeProducts,
        suppliers,
      },
      supplierOrders: {
        pending: pendingSupplierOrders,
      },
      conversion,
    };
  }

  async getSalesReport(
    startDate: string,
    endDate: string,
    groupBy: "day" | "week" | "month",
    market?: MarketCode,
  ) {
    const trunc = groupBy === "day" ? "day" : groupBy === "week" ? "week" : "month";
    const qb = this.invoiceRepo
      .createQueryBuilder("i")
      .leftJoin("i.client", "client")
      .select(`DATE_TRUNC('${trunc}', i.issueDate)`, "period")
      .addSelect("SUM(i.total)", "totalSales")
      .where("i.issueDate BETWEEN :start AND :end", { start: startDate, end: endDate })
      .andWhere("i.status = :status", { status: InvoiceStatus.PAID })
      .groupBy("period")
      .orderBy("period", "ASC");

    if (market) {
      qb.andWhere("client.country = :market", { market });
    }

    return qb.getRawMany();
  }

  async getTopProducts(limit = 10, market?: MarketCode) {
    const qb = this.lineItemRepo
      .createQueryBuilder("li")
      .leftJoin("li.order", "o")
      .leftJoin("o.client", "client")
      .select("li.productSku", "sku")
      .addSelect("SUM(li.quantityOrdered)", "totalSold")
      .addSelect("SUM(li.lineTotal)", "totalRevenue")
      .groupBy("li.productSku")
      .orderBy('"totalSold"', "DESC")
      .limit(limit);

    if (market) {
      qb.andWhere("client.country = :market", { market });
    }

    return qb.getRawMany();
  }

  async getSuppliersReport(market?: MarketCode) {
    const qb = this.supplierOrderRepo
      .createQueryBuilder("so")
      .leftJoin("so.supplier", "s")
      .leftJoin("so.clientOrder", "co")
      .leftJoin("co.client", "client")
      .select("s.name", "supplierName")
      .addSelect("COUNT(so.id)", "orderCount")
      .groupBy("s.name")
      .orderBy('"orderCount"', "DESC");

    if (market) {
      qb.andWhere("client.country = :market", { market });
    }

    return qb.getRawMany();
  }

  async getConversionReport(market?: MarketCode) {
    const solicitudesQb = this.proposalRepo
      .createQueryBuilder("p")
      .leftJoin("p.client", "client")
      .where("p.type = :type", { type: ProposalType.SOLICITUD });

    if (market) {
      solicitudesQb.andWhere("client.country = :market", { market });
    }

    const solicitudes = await solicitudesQb.getCount();

    const proformasQb = this.proposalRepo
      .createQueryBuilder("p")
      .leftJoin("p.client", "client")
      .where("p.status = :status", { status: ProposalStatus.PROFORMA_READY });

    if (market) {
      proformasQb.andWhere("client.country = :market", { market });
    }

    const proformas = await proformasQb.getCount();

    const signedQb = this.proposalRepo
      .createQueryBuilder("p")
      .leftJoin("p.client", "client")
      .where("p.status = :status", { status: ProposalStatus.SIGNED });

    if (market) {
      signedQb.andWhere("client.country = :market", { market });
    }

    const signed = await signedQb.getCount();

    const ordersQb = this.orderRepo
      .createQueryBuilder("o")
      .leftJoin("o.client", "client");

    if (market) {
      ordersQb.andWhere("client.country = :market", { market });
    }

    const orders = await ordersQb.getCount();

    const invoicesQb = this.invoiceRepo
      .createQueryBuilder("i")
      .leftJoin("i.client", "client")
      .where("i.status = :status", { status: InvoiceStatus.PAID });

    if (market) {
      invoicesQb.andWhere("client.country = :market", { market });
    }

    const invoices = await invoicesQb.getCount();

    return { solicitudes, proformas, signed, orders, invoices };
  }
}
