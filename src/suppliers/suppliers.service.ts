import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { Supplier } from "./entities/supplier.entity";
import { FactoryCode } from "./entities/factory-code.entity";
import { SupplierFamily } from "./entities/supplier-family.entity";
import { Product } from "../products/product.entity";
import { ProductFamily } from "../products/entities/product-family.entity";
import { User, UserRole } from "../users/user.entity";
import { MarketCode } from "../common/market";
import {
  CreateFactoryCodeDto,
  CreateSupplierDto,
  UpdateFactoryCodeDto,
  UpdateSupplierDto,
} from "./suppliers.dto";

export type SupplierWithFamilies = Supplier & { familyCodes: string[] };

@Injectable()
export class SuppliersService {
  constructor(
    @InjectRepository(Supplier)
    private readonly supplierRepo: Repository<Supplier>,
    @InjectRepository(FactoryCode)
    private readonly factoryCodeRepo: Repository<FactoryCode>,
    @InjectRepository(SupplierFamily)
    private readonly supplierFamilyRepo: Repository<SupplierFamily>,
    @InjectRepository(ProductFamily)
    private readonly familyRepo: Repository<ProductFamily>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
  ) {}

  private requireAdmin(user: User): void {
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException("Solo administradores");
    }
  }

  private normalizePrefix(raw: string): string {
    const prefix = raw
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 3);
    if (prefix.length !== 3) {
      throw new BadRequestException("Prefijo debe ser 3 letras/números");
    }
    return prefix;
  }

  private async assertFamiliesExist(familyCodes: string[]): Promise<string[]> {
    const codes = [
      ...new Set(familyCodes.map((c) => c.trim().toUpperCase()).filter(Boolean)),
    ];
    if (codes.length === 0) {
      throw new BadRequestException("El proveedor debe enlazarse al menos a una familia");
    }
    const found = await this.familyRepo.findBy({ code: In(codes) });
    if (found.length !== codes.length) {
      const foundSet = new Set(found.map((f) => f.code));
      const missing = codes.filter((c) => !foundSet.has(c));
      throw new BadRequestException(`Familias no válidas: ${missing.join(", ")}`);
    }
    return codes;
  }

  private async syncFamilyLinks(
    supplierId: string,
    familyCodes: string[],
  ): Promise<void> {
    await this.supplierFamilyRepo.delete({ supplierId });
    if (familyCodes.length === 0) return;
    await this.supplierFamilyRepo.save(
      familyCodes.map((familyCode) =>
        this.supplierFamilyRepo.create({ supplierId, familyCode }),
      ),
    );
  }

  private async withFamilyCodes(
    suppliers: Supplier[],
  ): Promise<SupplierWithFamilies[]> {
    if (suppliers.length === 0) return [];
    const ids = suppliers.map((s) => s.id);
    const links = await this.supplierFamilyRepo.find({
      where: { supplierId: In(ids) },
    });
    const bySupplier = new Map<string, string[]>();
    for (const link of links) {
      const list = bySupplier.get(link.supplierId) ?? [];
      list.push(link.familyCode);
      bySupplier.set(link.supplierId, list);
    }
    return suppliers.map((s) =>
      Object.assign(s, { familyCodes: bySupplier.get(s.id) ?? [] }),
    );
  }

  async listSuppliers(
    includeInactive = false,
    market?: MarketCode,
    familyCode?: string,
  ): Promise<SupplierWithFamilies[]> {
    const qb = this.supplierRepo.createQueryBuilder("s").orderBy("s.name", "ASC");

    if (market) {
      qb.where("(s.market = :market OR (s.market IS NULL AND :market = :ve))", {
        market,
        ve: MarketCode.VE,
      });
    }

    if (!includeInactive) {
      qb.andWhere("s.isActive = :active", { active: true });
    }

    if (familyCode) {
      qb.innerJoin(
        SupplierFamily,
        "sf",
        "sf.supplierId = s.id AND sf.familyCode = :familyCode",
        { familyCode: familyCode.toUpperCase() },
      );
    }

    const suppliers = await qb.getMany();
    return this.withFamilyCodes(suppliers);
  }

  async findSupplier(id: string): Promise<SupplierWithFamilies> {
    const supplier = await this.supplierRepo.findOneBy({ id });
    if (!supplier) throw new NotFoundException("Proveedor no encontrado");
    const [withFamilies] = await this.withFamilyCodes([supplier]);
    return withFamilies;
  }

  async isSupplierLinkedToFamily(
    supplierId: string,
    familyCode: string,
  ): Promise<boolean> {
    const link = await this.supplierFamilyRepo.findOneBy({
      supplierId,
      familyCode: familyCode.toUpperCase(),
    });
    return !!link;
  }

  private normalizeContactList(values: string[] | undefined): string[] {
    if (!values?.length) return [];
    const seen = new Set<string>();
    const result: string[] = [];
    for (const raw of values) {
      const value = raw.trim();
      if (!value) continue;
      const key = value.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(value);
    }
    return result;
  }

  async createSupplier(
    dto: CreateSupplierDto,
    user: User,
  ): Promise<SupplierWithFamilies> {
    this.requireAdmin(user);
    const prefix = this.normalizePrefix(dto.prefix);
    const taken = await this.supplierRepo.findOneBy({ prefix });
    if (taken) throw new BadRequestException(`Prefijo ${prefix} ya en uso`);

    const familyCodes = await this.assertFamiliesExist(dto.familyCodes);

    const emails = this.normalizeContactList(dto.emails).filter(
      (e) => e.toLowerCase() !== dto.email.trim().toLowerCase(),
    );
    const phones = this.normalizeContactList(dto.phones).filter(
      (p) => !dto.phone || p.toLowerCase() !== dto.phone.trim().toLowerCase(),
    );

    const { familyCodes: _fc, prefix: _p, ...rest } = dto;
    const supplier = this.supplierRepo.create({
      ...rest,
      prefix,
      emails,
      phones,
      market: dto.market ?? MarketCode.VE,
      taxExempt: dto.taxExempt ?? false,
      taxRate: dto.taxExempt ? 0 : (dto.taxRate ?? null),
    });
    const saved = await this.supplierRepo.save(supplier);
    await this.syncFamilyLinks(saved.id, familyCodes);
    return this.findSupplier(saved.id);
  }

  async updateSupplier(
    id: string,
    dto: UpdateSupplierDto,
    user: User,
  ): Promise<SupplierWithFamilies> {
    this.requireAdmin(user);
    const supplier = await this.supplierRepo.findOneBy({ id });
    if (!supplier) throw new NotFoundException("Proveedor no encontrado");

    const { emails, phones, familyCodes, prefix, ...rest } = dto;
    Object.assign(supplier, rest);

    if (prefix !== undefined) {
      const normalized = this.normalizePrefix(prefix);
      if (normalized !== supplier.prefix) {
        const taken = await this.supplierRepo.findOneBy({ prefix: normalized });
        if (taken && taken.id !== id) {
          throw new BadRequestException(`Prefijo ${normalized} ya en uso`);
        }
        supplier.prefix = normalized;
      }
    }

    if (emails !== undefined) {
      const primary = (rest.email ?? supplier.email).trim().toLowerCase();
      supplier.emails = this.normalizeContactList(emails).filter(
        (e) => e.toLowerCase() !== primary,
      );
    }
    if (phones !== undefined) {
      const primaryPhone = (rest.phone ?? supplier.phone ?? "").trim().toLowerCase();
      supplier.phones = this.normalizeContactList(phones).filter(
        (p) => !primaryPhone || p.toLowerCase() !== primaryPhone,
      );
    }
    if (supplier.taxExempt) supplier.taxRate = 0;

    await this.supplierRepo.save(supplier);

    if (familyCodes !== undefined) {
      const codes = await this.assertFamiliesExist(familyCodes);
      await this.syncFamilyLinks(id, codes);
    }

    return this.findSupplier(id);
  }

  async deleteSupplier(id: string, user: User): Promise<void> {
    this.requireAdmin(user);
    const supplier = await this.supplierRepo.findOneBy({ id });
    if (!supplier) throw new NotFoundException("Proveedor no encontrado");
    await this.supplierRepo.remove(supplier);
  }

  async listFactoryCodes(
    supplierId?: string,
    productSku?: string,
    market?: MarketCode,
  ): Promise<FactoryCode[]> {
    const qb = this.factoryCodeRepo.createQueryBuilder("fc")
      .leftJoinAndSelect("fc.supplier", "supplier")
      .leftJoinAndSelect("fc.product", "product")
      .orderBy("fc.createdAt", "DESC");

    if (supplierId) qb.andWhere("fc.supplierId = :supplierId", { supplierId });
    if (productSku) qb.andWhere("fc.productSku = :productSku", { productSku });
    if (market) {
      qb.andWhere(
        "(supplier.market = :market OR (supplier.market IS NULL AND :market = :ve))",
        { market, ve: MarketCode.VE },
      );
    }

    return qb.getMany();
  }

  async createFactoryCode(dto: CreateFactoryCodeDto, user: User): Promise<FactoryCode> {
    this.requireAdmin(user);

    const product = await this.productRepo.findOneBy({ sku: dto.productSku });
    if (!product) throw new NotFoundException("Producto no encontrado");

    await this.findSupplier(dto.supplierId);

    if (dto.isPrimary) {
      await this.factoryCodeRepo.update(
        { productSku: dto.productSku },
        { isPrimary: false },
      );
    }

    const fc = this.factoryCodeRepo.create(dto);
    return this.factoryCodeRepo.save(fc);
  }

  async updateFactoryCode(
    id: string,
    dto: UpdateFactoryCodeDto,
    user: User,
  ): Promise<FactoryCode> {
    this.requireAdmin(user);
    const fc = await this.factoryCodeRepo.findOneBy({ id });
    if (!fc) throw new NotFoundException("Código de fábrica no encontrado");

    if (dto.isPrimary) {
      await this.factoryCodeRepo.update(
        { productSku: fc.productSku },
        { isPrimary: false },
      );
    }

    Object.assign(fc, dto);
    return this.factoryCodeRepo.save(fc);
  }

  async deleteFactoryCode(id: string, user: User): Promise<void> {
    this.requireAdmin(user);
    const fc = await this.factoryCodeRepo.findOneBy({ id });
    if (!fc) throw new NotFoundException("Código de fábrica no encontrado");
    await this.factoryCodeRepo.remove(fc);
  }

  async getPrimaryFactoryCode(productSku: string): Promise<FactoryCode | null> {
    return this.factoryCodeRepo.findOne({
      where: { productSku, isPrimary: true },
      relations: ["supplier"],
    });
  }
}
