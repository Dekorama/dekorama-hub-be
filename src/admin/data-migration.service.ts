import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { MarketCode } from "../common/market";
import { Product } from "../products/product.entity";
import { Supplier } from "../suppliers/entities/supplier.entity";
import { Project } from "../projects/project.entity";
import { User } from "../users/user.entity";
import { ClientOrderLineItem } from "../orders/entities/client-order-line-item.entity";
import { FactoryCode } from "../suppliers/entities/factory-code.entity";

@Injectable()
export class DataMigrationService implements OnModuleInit {
  private readonly logger = new Logger(DataMigrationService.name);

  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(Supplier)
    private readonly supplierRepo: Repository<Supplier>,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(ClientOrderLineItem)
    private readonly clientLineItemRepo: Repository<ClientOrderLineItem>,
    @InjectRepository(FactoryCode)
    private readonly factoryCodeRepo: Repository<FactoryCode>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.migrateLegacyMarketData();
    await this.warnSkusWithoutPrimarySupplier();
  }

  /** Asigna Venezuela a registros legacy sin mercado/país. */
  async migrateLegacyMarketData(): Promise<void> {
    const products = await this.productRepo
      .createQueryBuilder()
      .update(Product)
      .set({ market: MarketCode.VE })
      .where("market IS NULL")
      .execute();

    const suppliers = await this.supplierRepo
      .createQueryBuilder()
      .update(Supplier)
      .set({ market: MarketCode.VE })
      .where("market IS NULL")
      .execute();

    const users = await this.userRepo
      .createQueryBuilder()
      .update(User)
      .set({ country: MarketCode.VE })
      .where("country IS NULL")
      .execute();

    const projectsFromClient = await this.projectRepo.query(`
      UPDATE projects p
      SET country = COALESCE(u.country, 'VE')
      FROM users u
      WHERE p."clientId" = u.id
        AND (p.country IS NULL OR p.country = '' OR p.country NOT IN ('VE', 'ES'))
    `);

    const projectsOrphan = await this.projectRepo
      .createQueryBuilder()
      .update(Project)
      .set({ country: MarketCode.VE })
      .where("country IS NULL OR country = ''")
      .execute();

    const projectClientRows = Number(projectsFromClient?.[1] ?? 0);
    const total =
      (products.affected ?? 0) +
      (suppliers.affected ?? 0) +
      (users.affected ?? 0) +
      (projectsOrphan.affected ?? 0) +
      projectClientRows;

    if (total > 0) {
      this.logger.log(
        `Legacy market migration (VE): products=${products.affected ?? 0}, suppliers=${suppliers.affected ?? 0}, users=${users.affected ?? 0}, projects=${(projectsOrphan.affected ?? 0) + projectClientRows}`,
      );
    }
  }

  /** SKUs en pedidos pendientes sin proveedor primario — solo log, no bloqueante. */
  async warnSkusWithoutPrimarySupplier(): Promise<void> {
    const pendingLines = await this.clientLineItemRepo
      .createQueryBuilder("li")
      .where("li.quantitySentToSupplier < li.quantityOrdered")
      .getMany();

    const skus = [...new Set(pendingLines.map((l) => l.productSku))];
    const missing: string[] = [];

    for (const sku of skus) {
      const primary = await this.factoryCodeRepo.findOne({
        where: { productSku: sku, isPrimary: true },
      });
      if (!primary) missing.push(sku);
    }

    if (missing.length > 0) {
      this.logger.warn(
        `SKUs en pedidos sin proveedor primario (${missing.length}): ${missing.slice(0, 20).join(", ")}${missing.length > 20 ? "…" : ""}`,
      );
    }
  }
}
