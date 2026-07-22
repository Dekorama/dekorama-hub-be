import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { FinishType, PricingMode, Product } from "./product.entity";
import { ProductFamily } from "./entities/product-family.entity";
import { ProductSubfamily } from "./entities/product-subfamily.entity";
import { User, UserRole } from "../users/user.entity";
import { MarketCode } from "../common/market";
import { Supplier } from "../suppliers/entities/supplier.entity";
import { FactoryCode } from "../suppliers/entities/factory-code.entity";
import { SupplierFamily } from "../suppliers/entities/supplier-family.entity";
import {
  CreateProductDto,
  UpdateProductDto,
  CreateFamilyDto,
  CreateSubfamilyDto,
  UpdateFamilyDto,
  UpdateSubfamilyDto,
} from "./product.dto";

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly repo: Repository<Product>,
    @InjectRepository(ProductFamily)
    private readonly familyRepo: Repository<ProductFamily>,
    @InjectRepository(ProductSubfamily)
    private readonly subfamilyRepo: Repository<ProductSubfamily>,
    @InjectRepository(Supplier)
    private readonly supplierRepo: Repository<Supplier>,
    @InjectRepository(FactoryCode)
    private readonly factoryCodeRepo: Repository<FactoryCode>,
    @InjectRepository(SupplierFamily)
    private readonly supplierFamilyRepo: Repository<SupplierFamily>,
  ) {}

  private async assertSupplierLinkedToFamily(
    supplierId: string,
    familyCode: string,
  ): Promise<void> {
    await this.ensureSupplierFamilyLink(supplierId, familyCode);
  }

  private isM2Unit(unit?: string | null): boolean {
    if (!unit) return false;
    const normalized = unit
      .trim()
      .toLowerCase()
      .replace("²", "2")
      .replace(/\s+/g, "");
    return normalized === "m2";
  }

  private assertM2Packaging(
    unit: string | null | undefined,
    piecesPerBox: number | null | undefined,
    unitPerPiece: number | null | undefined,
  ): void {
    if (!this.isM2Unit(unit)) return;
    if (
      piecesPerBox === undefined ||
      piecesPerBox === null ||
      Number(piecesPerBox) < 1
    ) {
      throw new BadRequestException(
        "Unidad m2 requiere piezas por caja (> 0)",
      );
    }
    if (
      unitPerPiece === undefined ||
      unitPerPiece === null ||
      Number(unitPerPiece) <= 0
    ) {
      throw new BadRequestException(
        "Unidad m2 requiere cobertura por caja en m² (> 0)",
      );
    }
  }

  /** Upsert junction so product create can link supplier ↔ family on the fly. */
  private async ensureSupplierFamilyLink(
    supplierId: string,
    familyCode: string,
  ): Promise<void> {
    const existing = await this.supplierFamilyRepo.findOneBy({
      supplierId,
      familyCode,
    });
    if (existing) return;

    const family = await this.familyRepo.findOneBy({ code: familyCode });
    if (!family) throw new BadRequestException("Familia no válida");

    const supplier = await this.supplierRepo.findOneBy({ id: supplierId });
    if (!supplier) throw new BadRequestException("Proveedor no válido");

    await this.supplierFamilyRepo.save(
      this.supplierFamilyRepo.create({ supplierId, familyCode }),
    );
  }

  async list(opts: {
    search?: string;
    family?: string;
    subfamily?: string;
    supplierId?: string;
    market?: MarketCode;
    activeOnly?: boolean;
    page?: number;
    limit?: number;
  }): Promise<{ items: Product[]; total: number; page: number; limit: number } | Product[]> {
    const {
      search,
      family,
      subfamily,
      supplierId,
      market,
      activeOnly = false,
      page,
      limit,
    } = opts;

    const usePagination = page !== undefined && limit !== undefined;
    const pageNum = Math.max(1, page ?? 1);
    const limitNum = Math.min(100, Math.max(1, limit ?? 24));

    const qb = this.repo.createQueryBuilder("p").orderBy("p.name", "ASC");

    if (market) {
      qb.where("(p.market = :market OR (p.market IS NULL AND :market = :ve))", {
        market,
        ve: MarketCode.VE,
      });
    }

    if (activeOnly) {
      qb.andWhere("p.isActive = true");
    }
    if (family) qb.andWhere("p.family = :family", { family });
    if (subfamily) qb.andWhere("p.subfamily = :subfamily", { subfamily });
    if (supplierId) {
      qb.innerJoin("p.subfamilyRelation", "sf").andWhere(
        "sf.supplierId = :supplierId",
        { supplierId },
      );
    }
    if (search?.trim()) {
      qb.andWhere("(p.name ILIKE :search OR p.sku ILIKE :search)", {
        search: `%${search.trim()}%`,
      });
    }

    if (!usePagination) {
      return qb.getMany();
    }

    qb.skip((pageNum - 1) * limitNum).take(limitNum);
    const [items, total] = await qb.getManyAndCount();
    return { items, total, page: pageNum, limit: limitNum };
  }

  async findOne(id: string): Promise<Product> {
    const product = await this.repo.findOneBy({ id });
    if (!product) throw new NotFoundException("Producto no encontrado");
    return product;
  }

  async findBySku(sku: string): Promise<Product> {
    const product = await this.repo.findOneBy({ sku });
    if (!product) throw new NotFoundException("Producto no encontrado");
    return product;
  }

  async getCatalogFilters(market?: MarketCode): Promise<{
    families: Array<{ code: string; name: string; icon: string | null }>;
    suppliers: Array<{ id: string; name: string; familyCodes: string[] }>;
  }> {
    const families = await this.familyRepo.find({
      order: { name: "ASC" },
      select: ["code", "name", "icon"],
    });

    const qb = this.subfamilyRepo
      .createQueryBuilder("sf")
      .innerJoin(
        Product,
        "p",
        "p.subfamily = sf.code AND p.family = sf.familyCode",
      )
      .where("sf.supplierId IS NOT NULL")
      .andWhere("p.isActive = true");

    if (market) {
      qb.andWhere("(p.market = :market OR (p.market IS NULL AND :market = :ve))", {
        market,
        ve: MarketCode.VE,
      });
    }

    const rows = await qb
      .select("sf.supplierId", "id")
      .addSelect("sf.name", "name")
      .addSelect("sf.familyCode", "familyCode")
      .distinct(true)
      .orderBy("sf.name", "ASC")
      .getRawMany<{ id: string; name: string; familyCode: string }>();

    const supplierMap = new Map<
      string,
      { id: string; name: string; familyCodes: string[] }
    >();
    for (const row of rows) {
      const existing = supplierMap.get(row.id);
      if (existing) {
        if (!existing.familyCodes.includes(row.familyCode)) {
          existing.familyCodes.push(row.familyCode);
        }
      } else {
        supplierMap.set(row.id, {
          id: row.id,
          name: row.name,
          familyCodes: [row.familyCode],
        });
      }
    }

    return {
      families: families.map((f) => ({
        code: f.code,
        name: f.name,
        icon: f.icon,
      })),
      suppliers: Array.from(supplierMap.values()).sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
    };
  }

  /**
   * Subfamilia = proveedor bajo una familia.
   * Reusa si ya existe para family+supplier; si no, crea con código 3 letras único.
   */
  async ensureSubfamilyForSupplier(
    familyCode: string,
    supplierId: string,
  ): Promise<ProductSubfamily> {
    const family = await this.familyRepo.findOneBy({ code: familyCode });
    if (!family) throw new BadRequestException("Familia no válida");

    const supplier = await this.supplierRepo.findOneBy({ id: supplierId });
    if (!supplier) throw new BadRequestException("Proveedor no válido");

    const existing = await this.subfamilyRepo.findOneBy({
      familyCode,
      supplierId,
    });
    if (existing) {
      if (existing.name !== supplier.name) {
        existing.name = supplier.name;
        existing.updatedAt = new Date();
        await this.subfamilyRepo.save(existing);
        await this.repo.update(
          { family: familyCode, subfamily: existing.code },
          { subfamilyName: supplier.name },
        );
      }
      return existing;
    }

    const code = await this.generateUniqueSubfamilyCode(supplier.name);
    return this.subfamilyRepo.save(
      this.subfamilyRepo.create({
        code,
        familyCode,
        supplierId,
        name: supplier.name,
        description: `Proveedor: ${supplier.name}`,
      }),
    );
  }

  private async generateUniqueSubfamilyCode(supplierName: string): Promise<string> {
    const letters = supplierName
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");

    const wordStarts = supplierName
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .split(/[^A-Z0-9]+/)
      .filter(Boolean)
      .map((w) => w[0])
      .join("");

    const candidates: string[] = [];
    if (wordStarts.length >= 3) candidates.push(wordStarts.slice(0, 3));
    if (letters.length >= 3) candidates.push(letters.slice(0, 3));
    if (letters.length >= 2) candidates.push((letters + "X").slice(0, 3));
    if (letters.length >= 1) candidates.push((letters[0] + "00").slice(0, 3));
    candidates.push("PRV");

    for (const base of candidates) {
      const code = base.padEnd(3, "X").slice(0, 3);
      const taken = await this.subfamilyRepo.findOneBy({ code });
      if (!taken) return code;
    }

    for (let i = 0; i < 26; i++) {
      for (let j = 0; j < 100; j++) {
        const code = `${String.fromCharCode(65 + i)}${String(j).padStart(2, "0")}`;
        const taken = await this.subfamilyRepo.findOneBy({ code });
        if (!taken) return code;
      }
    }

    throw new BadRequestException("No se pudo generar código de subfamilia");
  }

  private async upsertPrimaryFactoryCode(
    productSku: string,
    supplierId: string,
    factoryCode: string,
    factoryCost?: number,
  ): Promise<void> {
    await this.factoryCodeRepo.update({ productSku }, { isPrimary: false });

    const existing = await this.factoryCodeRepo.findOne({
      where: { productSku, supplierId },
    });

    if (existing) {
      existing.factoryCode = factoryCode;
      existing.isPrimary = true;
      if (factoryCost !== undefined) existing.factoryCost = factoryCost;
      await this.factoryCodeRepo.save(existing);
      return;
    }

    await this.factoryCodeRepo.save(
      this.factoryCodeRepo.create({
        productSku,
        supplierId,
        factoryCode,
        factoryCost: factoryCost ?? null,
        isPrimary: true,
      }),
    );
  }

  async create(dto: CreateProductDto, admin: User): Promise<Product> {
    if (admin.role !== UserRole.ADMIN)
      throw new ForbiddenException("Solo administradores pueden crear productos");

    const family = await this.familyRepo.findOneBy({ code: dto.family });
    if (!family) throw new BadRequestException("Familia no válida");

    if (!dto.supplierId) {
      throw new BadRequestException("Proveedor obligatorio");
    }

    await this.assertSupplierLinkedToFamily(dto.supplierId, dto.family);

    const supplier = await this.supplierRepo.findOneBy({ id: dto.supplierId });
    if (!supplier) throw new BadRequestException("Proveedor no válido");
    if (!supplier.prefix) {
      throw new BadRequestException("Proveedor sin prefijo configurado");
    }

    const subfamily = await this.ensureSubfamilyForSupplier(dto.family, dto.supplierId);

    const pricingMode = dto.pricingMode ?? PricingMode.NETO;
    if (dto.family === "REV") {
      if (!dto.finishType || !Object.values(FinishType).includes(dto.finishType)) {
        throw new BadRequestException("Revestimiento requiere tipo: decorado o pieza_lisa");
      }
    }

    if (pricingMode === PricingMode.PVP) {
      if (dto.pvpPrice === undefined || dto.pvpPrice === null) {
        throw new BadRequestException("Modo PVP requiere pvpPrice");
      }
      if (dto.profitMargin === undefined || dto.profitMargin === null) {
        throw new BadRequestException("Modo PVP requiere profitMargin");
      }
    }

    const unit = dto.unit ?? "unidad";
    const isM2 = this.isM2Unit(unit);
    this.assertM2Packaging(unit, dto.piecesPerBox, dto.unitPerPiece);

    const market = dto.market ?? MarketCode.VE;
    const sku = await this.generateSku(supplier.prefix);
    // Pedidos a proveedor usan el SKU como referencia de fábrica.
    const resolvedFactoryCode = sku;

    const product = this.repo.create({
      name: dto.name,
      family: dto.family,
      subfamily: subfamily.code,
      pricingMode,
      finishType: dto.family === "REV" ? dto.finishType! : null,
      factoryCost: dto.factoryCost ?? 0,
      profitMargin: dto.profitMargin ?? 0,
      pvpPrice: pricingMode === PricingMode.PVP ? dto.pvpPrice! : 0,
      unit,
      piecesPerBox: isM2 ? Number(dto.piecesPerBox) : null,
      unitPerPiece: isM2 ? Number(dto.unitPerPiece) : null,
      stock: market === MarketCode.ES ? 0 : (dto.stock ?? 0),
      description: dto.description,
      imageUrl: dto.imageUrl,
      isActive: dto.isActive,
      sku,
      market,
      familyName: family.name,
      subfamilyName: subfamily.name,
    });

    const saved = await this.repo.save(product);

    await this.upsertPrimaryFactoryCode(
      saved.sku,
      dto.supplierId,
      resolvedFactoryCode,
      Number(saved.factoryCost),
    );

    return saved;
  }

  private async generateSku(prefix: string): Promise<string> {
    const normalized = prefix.toUpperCase();
    const last = await this.repo
      .createQueryBuilder("p")
      .where("p.sku LIKE :pattern", { pattern: `${normalized}-%` })
      .orderBy("p.sku", "DESC")
      .getOne();

    let sequentialId = 1;
    if (last?.sku) {
      const match = last.sku.match(/-(\d{5})$/);
      if (match) {
        sequentialId = parseInt(match[1], 10) + 1;
      }
    }

    return `${normalized}-${String(sequentialId).padStart(5, "0")}`;
  }

  async update(
    id: string,
    dto: UpdateProductDto,
    admin: User,
  ): Promise<Product> {
    if (admin.role !== UserRole.ADMIN)
      throw new ForbiddenException("Solo administradores pueden editar productos");

    const product = await this.repo.findOneBy({ id });
    if (!product) throw new NotFoundException("Producto no encontrado");

    const nextFamily = product.family;
    const pricingMode = dto.pricingMode ?? product.pricingMode;

    if (dto.finishType !== undefined) {
      if (nextFamily === "REV") {
        if (!dto.finishType || !Object.values(FinishType).includes(dto.finishType)) {
          throw new BadRequestException("Revestimiento requiere tipo: decorado o pieza_lisa");
        }
      } else {
        product.finishType = null;
      }
    }

    if (pricingMode === PricingMode.PVP) {
      const pvp = dto.pvpPrice ?? product.pvpPrice;
      if (pvp === undefined || pvp === null) {
        throw new BadRequestException("Modo PVP requiere pvpPrice");
      }
      const margin = dto.profitMargin ?? product.profitMargin;
      if (margin === undefined || margin === null) {
        throw new BadRequestException("Modo PVP requiere profitMargin");
      }
    }

    const pricingFieldsChanged =
      dto.pricingMode !== undefined ||
      dto.factoryCost !== undefined ||
      dto.profitMargin !== undefined ||
      dto.pvpPrice !== undefined;

    const {
      supplierId,
      factoryCode,
      ...productFields
    } = dto;

    Object.assign(product, productFields);

    if (nextFamily !== "REV") {
      product.finishType = null;
    } else if (dto.finishType !== undefined) {
      product.finishType = dto.finishType;
    }

    product.pricingMode = pricingMode;

    const market = dto.market ?? product.market;
    if (market === MarketCode.ES) {
      product.stock = 0;
    }

    if (supplierId) {
      await this.assertSupplierLinkedToFamily(supplierId, product.family);
      const subfamily = await this.ensureSubfamilyForSupplier(product.family, supplierId);
      product.subfamily = subfamily.code;
      product.subfamilyName = subfamily.name;
    }

    const effectiveUnit = dto.unit ?? product.unit;
    if (this.isM2Unit(effectiveUnit)) {
      const pieces =
        dto.piecesPerBox !== undefined ? dto.piecesPerBox : product.piecesPerBox;
      const perPiece =
        dto.unitPerPiece !== undefined ? dto.unitPerPiece : product.unitPerPiece;
      this.assertM2Packaging(effectiveUnit, pieces, perPiece);
      product.piecesPerBox = Number(pieces);
      product.unitPerPiece = Number(perPiece);
    } else if (dto.unit !== undefined) {
      product.piecesPerBox = null;
      product.unitPerPiece = null;
    }

    const saved = await this.repo.save(product);

    if (supplierId || factoryCode !== undefined || pricingFieldsChanged) {
      let resolvedSupplierId = supplierId;
      let resolvedFactoryCode = factoryCode?.trim();

      if (!resolvedSupplierId || !resolvedFactoryCode) {
        const primary = await this.factoryCodeRepo.findOne({
          where: { productSku: saved.sku, isPrimary: true },
        });
        resolvedSupplierId = resolvedSupplierId ?? primary?.supplierId;
        resolvedFactoryCode =
          resolvedFactoryCode || primary?.factoryCode || saved.sku;
      }

      if (resolvedSupplierId && resolvedFactoryCode) {
        await this.upsertPrimaryFactoryCode(
          saved.sku,
          resolvedSupplierId,
          resolvedFactoryCode,
          Number(saved.factoryCost),
        );
      }
    }

    return saved;
  }

  async remove(id: string, admin: User): Promise<void> {
    if (admin.role !== UserRole.ADMIN)
      throw new ForbiddenException("Solo administradores pueden eliminar productos");

    const product = await this.repo.findOneBy({ id });
    if (!product) throw new NotFoundException("Producto no encontrado");
    await this.repo.remove(product);
  }

  async getFamilies(): Promise<ProductFamily[]> {
    return this.familyRepo.find({ order: { name: "ASC" } });
  }

  async getSubfamilies(familyCode?: string): Promise<ProductSubfamily[]> {
    if (familyCode) {
      return this.subfamilyRepo.find({
        where: { familyCode },
        order: { name: "ASC" },
      });
    }
    return this.subfamilyRepo.find({ order: { name: "ASC" } });
  }

  async createFamily(dto: CreateFamilyDto, admin: User): Promise<ProductFamily> {
    if (admin.role !== UserRole.ADMIN) throw new ForbiddenException("Solo administradores");
    const code = dto.code
      ? dto.code.trim().toUpperCase()
      : await this.generateUniqueFamilyCode(dto.name);
    if (code.length !== 3) {
      throw new BadRequestException("Código familia: 3 caracteres");
    }
    const existing = await this.familyRepo.findOneBy({ code });
    if (existing) throw new BadRequestException("Familia ya existe");
    return this.familyRepo.save(
      this.familyRepo.create({
        code,
        name: dto.name,
        description: dto.description ?? null,
        icon: dto.icon ?? null,
      }),
    );
  }

  private async generateUniqueFamilyCode(name: string): Promise<string> {
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

    const candidates: string[] = [];
    if (wordStarts.length >= 3) candidates.push(wordStarts.slice(0, 3));
    if (letters.length >= 3) candidates.push(letters.slice(0, 3));
    if (letters.length >= 2) candidates.push((letters + "X").slice(0, 3));
    if (letters.length >= 1) candidates.push((letters[0] + "00").slice(0, 3));
    candidates.push("FAM");

    for (const base of candidates) {
      const code = base.padEnd(3, "X").slice(0, 3);
      const taken = await this.familyRepo.findOneBy({ code });
      if (!taken) return code;
    }

    for (let i = 0; i < 26; i++) {
      for (let j = 0; j < 100; j++) {
        const code = `${String.fromCharCode(65 + i)}${String(j).padStart(2, "0")}`;
        const taken = await this.familyRepo.findOneBy({ code });
        if (!taken) return code;
      }
    }

    throw new BadRequestException("No se pudo generar código de familia");
  }

  async updateFamily(code: string, dto: UpdateFamilyDto, admin: User): Promise<ProductFamily> {
    if (admin.role !== UserRole.ADMIN) throw new ForbiddenException("Solo administradores");
    const family = await this.familyRepo.findOneBy({ code });
    if (!family) throw new NotFoundException("Familia no encontrada");
    if (dto.name !== undefined) family.name = dto.name;
    if (dto.description !== undefined) family.description = dto.description;
    if (dto.icon !== undefined) family.icon = dto.icon;
    family.updatedAt = new Date();
    const saved = await this.familyRepo.save(family);
    if (dto.name !== undefined) {
      await this.repo.update({ family: code }, { familyName: dto.name });
    }
    return saved;
  }

  async createSubfamily(dto: CreateSubfamilyDto, admin: User): Promise<ProductSubfamily> {
    if (admin.role !== UserRole.ADMIN) throw new ForbiddenException("Solo administradores");
    const family = await this.familyRepo.findOneBy({ code: dto.familyCode });
    if (!family) throw new BadRequestException("Familia no válida");
    const existing = await this.subfamilyRepo.findOneBy({ code: dto.code });
    if (existing) throw new BadRequestException("Subfamilia ya existe");
    return this.subfamilyRepo.save(this.subfamilyRepo.create(dto));
  }

  async updateSubfamily(
    code: string,
    dto: UpdateSubfamilyDto,
    admin: User,
  ): Promise<ProductSubfamily> {
    if (admin.role !== UserRole.ADMIN) throw new ForbiddenException("Solo administradores");
    const sub = await this.subfamilyRepo.findOneBy({ code });
    if (!sub) throw new NotFoundException("Subfamilia no encontrada");
    if (dto.name !== undefined) sub.name = dto.name;
    if (dto.description !== undefined) sub.description = dto.description;
    sub.updatedAt = new Date();
    const saved = await this.subfamilyRepo.save(sub);
    if (dto.name !== undefined) {
      await this.repo.update({ subfamily: code }, { subfamilyName: dto.name });
    }
    return saved;
  }

  async deleteFamily(code: string, admin: User): Promise<void> {
    if (admin.role !== UserRole.ADMIN) throw new ForbiddenException("Solo administradores");
    const family = await this.familyRepo.findOneBy({ code });
    if (!family) throw new NotFoundException("Familia no encontrada");
    const products = await this.repo.count({ where: { family: code } });
    if (products > 0) {
      throw new BadRequestException("No se puede eliminar: hay productos en esta familia");
    }
    const subs = await this.subfamilyRepo.count({ where: { familyCode: code } });
    if (subs > 0) {
      throw new BadRequestException("Elimina primero las subfamilias");
    }
    await this.familyRepo.remove(family);
  }

  async deleteSubfamily(code: string, admin: User): Promise<void> {
    if (admin.role !== UserRole.ADMIN) throw new ForbiddenException("Solo administradores");
    const sub = await this.subfamilyRepo.findOneBy({ code });
    if (!sub) throw new NotFoundException("Subfamilia no encontrada");
    const products = await this.repo.count({ where: { subfamily: code } });
    if (products > 0) {
      throw new BadRequestException("No se puede eliminar: hay productos en esta subfamilia");
    }
    await this.subfamilyRepo.remove(sub);
  }
}
