import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { MarketCode } from "../common/market";
import { Product } from "../products/product.entity";
import { ProductSubfamily } from "../products/entities/product-subfamily.entity";
import { Supplier } from "../suppliers/entities/supplier.entity";
import { SupplierFamily } from "../suppliers/entities/supplier-family.entity";
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
    @InjectRepository(SupplierFamily)
    private readonly supplierFamilyRepo: Repository<SupplierFamily>,
    @InjectRepository(ProductSubfamily)
    private readonly subfamilyRepo: Repository<ProductSubfamily>,
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
    await this.migrateSupplierPrefixAndSkus();
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

  /**
   * 1) Assign Supplier.prefix from linked subfamily codes
   * 2) Populate supplier_families from subfamilies/products
   * 3) Rewrite DKM-{fam}-{sub}-{#####} SKUs → {prefix}-{#####}
   */
  async migrateSupplierPrefixAndSkus(): Promise<void> {
    const prefixesAssigned = await this.assignSupplierPrefixes();
    const linksCreated = await this.populateSupplierFamilies();
    const skusRewritten = await this.rewriteLegacySkus();

    if (prefixesAssigned > 0 || linksCreated > 0 || skusRewritten > 0) {
      this.logger.log(
        `Supplier prefix migration: prefixes=${prefixesAssigned}, familyLinks=${linksCreated}, skus=${skusRewritten}`,
      );
    }
  }

  private async assignSupplierPrefixes(): Promise<number> {
    const suppliers = await this.supplierRepo.find();
    let assigned = 0;
    const used = new Set(
      suppliers.map((s) => s.prefix?.toUpperCase()).filter(Boolean) as string[],
    );

    for (const supplier of suppliers) {
      if (supplier.prefix) continue;

      const sub = await this.subfamilyRepo.findOne({
        where: { supplierId: supplier.id },
        order: { createdAt: "ASC" },
      });

      let candidate =
        sub?.code?.toUpperCase() ??
        this.derivePrefixFromName(supplier.name);

      candidate = this.resolveUniquePrefix(candidate, used);
      used.add(candidate);
      supplier.prefix = candidate;
      await this.supplierRepo.save(supplier);
      assigned += 1;
    }

    return assigned;
  }

  private derivePrefixFromName(name: string): string {
    const letters = name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
    const wordStarts = name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .split(/[^A-Z0-9]+/)
      .filter(Boolean)
      .map((w) => w[0])
      .join("");

    if (wordStarts.length >= 3) return wordStarts.slice(0, 3);
    if (letters.length >= 3) return letters.slice(0, 3);
    if (letters.length >= 1) return (letters + "XXX").slice(0, 3);
    return "PRV";
  }

  private resolveUniquePrefix(base: string, used: Set<string>): string {
    const padded = (base + "XXX").slice(0, 3).toUpperCase();
    if (!used.has(padded)) return padded;

    for (let i = 0; i < 26; i++) {
      for (let j = 0; j < 100; j++) {
        const code = `${String.fromCharCode(65 + i)}${String(j).padStart(2, "0")}`;
        if (!used.has(code)) return code;
      }
    }
    return `X${String(used.size % 100).padStart(2, "0")}`;
  }

  private async populateSupplierFamilies(): Promise<number> {
    let created = 0;

    const subs = await this.subfamilyRepo.find();
    for (const sub of subs) {
      if (!sub.supplierId) continue;
      const existing = await this.supplierFamilyRepo.findOneBy({
        supplierId: sub.supplierId,
        familyCode: sub.familyCode,
      });
      if (existing) continue;
      await this.supplierFamilyRepo.save(
        this.supplierFamilyRepo.create({
          supplierId: sub.supplierId,
          familyCode: sub.familyCode,
        }),
      );
      created += 1;
    }

    const products = await this.productRepo.find();
    for (const product of products) {
      const primary = await this.factoryCodeRepo.findOne({
        where: { productSku: product.sku, isPrimary: true },
      });
      if (!primary) continue;
      const existing = await this.supplierFamilyRepo.findOneBy({
        supplierId: primary.supplierId,
        familyCode: product.family,
      });
      if (existing) continue;
      await this.supplierFamilyRepo.save(
        this.supplierFamilyRepo.create({
          supplierId: primary.supplierId,
          familyCode: product.family,
        }),
      );
      created += 1;
    }

    return created;
  }

  private async rewriteLegacySkus(): Promise<number> {
    const products = await this.productRepo.find({ order: { sku: "ASC" } });
    const legacy = products.filter((p) => /^DKM-[A-Z0-9]{3}-[A-Z0-9]{3}-\d{5}$/i.test(p.sku));
    if (legacy.length === 0) return 0;

    const seqByPrefix = new Map<string, number>();
    for (const p of products) {
      const m = p.sku.match(/^([A-Z0-9]{3})-(\d{5})$/i);
      if (!m) continue;
      const prefix = m[1].toUpperCase();
      const n = parseInt(m[2], 10);
      seqByPrefix.set(prefix, Math.max(seqByPrefix.get(prefix) ?? 0, n));
    }

    let rewritten = 0;

    for (const product of legacy) {
      const primary = await this.factoryCodeRepo.findOne({
        where: { productSku: product.sku, isPrimary: true },
        relations: ["supplier"],
      });

      let prefix = primary?.supplier?.prefix?.toUpperCase() ?? null;
      if (!prefix) {
        const sub = await this.subfamilyRepo.findOneBy({ code: product.subfamily });
        if (sub?.supplierId) {
          const supplier = await this.supplierRepo.findOneBy({ id: sub.supplierId });
          prefix = supplier?.prefix?.toUpperCase() ?? null;
        }
      }
      if (!prefix) {
        this.logger.warn(`Skip SKU rewrite (no supplier prefix): ${product.sku}`);
        continue;
      }

      const next = (seqByPrefix.get(prefix) ?? 0) + 1;
      seqByPrefix.set(prefix, next);
      const newSku = `${prefix}-${String(next).padStart(5, "0")}`;
      const oldSku = product.sku;

      if (newSku === oldSku) continue;

      await this.repointProductSku(oldSku, newSku);
      rewritten += 1;
    }

    return rewritten;
  }

  /** Clone product under new SKU, repoint refs, delete old row. */
  private async repointProductSku(oldSku: string, newSku: string): Promise<void> {
    await this.productRepo.manager.transaction(async (manager) => {
      const product = await manager.findOneBy(Product, { sku: oldSku });
      if (!product) return;

      const clash = await manager.findOneBy(Product, { sku: newSku });
      if (clash) {
        throw new Error(`SKU target already exists: ${newSku}`);
      }

      const {
        id: _id,
        createdAt: _c,
        updatedAt: _u,
        ...fields
      } = product as Product & { createdAt?: Date; updatedAt?: Date };

      const clone = manager.create(Product, { ...fields, sku: newSku });
      await manager.save(Product, clone);

      await manager.query(
        `UPDATE factory_codes SET "productSku" = $1 WHERE "productSku" = $2`,
        [newSku, oldSku],
      );
      await manager.query(
        `UPDATE client_order_line_items SET "productSku" = $1 WHERE "productSku" = $2`,
        [newSku, oldSku],
      );
      await manager.query(
        `UPDATE supplier_order_line_items SET "productSku" = $1 WHERE "productSku" = $2`,
        [newSku, oldSku],
      );
      await manager.query(
        `UPDATE invoice_line_items SET "productSku" = $1 WHERE "productSku" = $2`,
        [newSku, oldSku],
      );
      await manager.query(
        `UPDATE product_tags SET "productSku" = $1 WHERE "productSku" = $2`,
        [newSku, oldSku],
      );
      await manager.query(
        `UPDATE project_products SET product_sku = $1 WHERE product_sku = $2`,
        [newSku, oldSku],
      );

      await manager.delete(Product, { sku: oldSku });
    });
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
