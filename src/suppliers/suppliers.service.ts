import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Supplier } from "./entities/supplier.entity";
import { FactoryCode } from "./entities/factory-code.entity";
import { Product } from "../products/product.entity";
import { User, UserRole } from "../users/user.entity";
import { MarketCode } from "../common/market";
import {
  CreateFactoryCodeDto,
  CreateSupplierDto,
  UpdateFactoryCodeDto,
  UpdateSupplierDto,
} from "./suppliers.dto";

@Injectable()
export class SuppliersService {
  constructor(
    @InjectRepository(Supplier)
    private readonly supplierRepo: Repository<Supplier>,
    @InjectRepository(FactoryCode)
    private readonly factoryCodeRepo: Repository<FactoryCode>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
  ) {}

  private requireAdmin(user: User): void {
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException("Solo administradores");
    }
  }

  async listSuppliers(includeInactive = false, market?: MarketCode): Promise<Supplier[]> {
    if (market) {
      const qb = this.supplierRepo.createQueryBuilder("s").orderBy("s.name", "ASC");
      qb.where("(s.market = :market OR (s.market IS NULL AND :market = :ve))", {
        market,
        ve: MarketCode.VE,
      });
      if (!includeInactive) qb.andWhere("s.isActive = :active", { active: true });
      return qb.getMany();
    }

    const where: Record<string, unknown> = includeInactive ? {} : { isActive: true };
    return this.supplierRepo.find({ where: where as never, order: { name: "ASC" } });
  }

  async findSupplier(id: string): Promise<Supplier> {
    const supplier = await this.supplierRepo.findOneBy({ id });
    if (!supplier) throw new NotFoundException("Proveedor no encontrado");
    return supplier;
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

  async createSupplier(dto: CreateSupplierDto, user: User): Promise<Supplier> {
    this.requireAdmin(user);
    const emails = this.normalizeContactList(dto.emails).filter(
      (e) => e.toLowerCase() !== dto.email.trim().toLowerCase(),
    );
    const phones = this.normalizeContactList(dto.phones).filter(
      (p) => !dto.phone || p.toLowerCase() !== dto.phone.trim().toLowerCase(),
    );
    const supplier = this.supplierRepo.create({
      ...dto,
      emails,
      phones,
      market: dto.market ?? MarketCode.VE,
      taxExempt: dto.taxExempt ?? false,
      taxRate: dto.taxExempt ? 0 : (dto.taxRate ?? null),
    });
    return this.supplierRepo.save(supplier);
  }

  async updateSupplier(
    id: string,
    dto: UpdateSupplierDto,
    user: User,
  ): Promise<Supplier> {
    this.requireAdmin(user);
    const supplier = await this.findSupplier(id);
    const { emails, phones, ...rest } = dto;
    Object.assign(supplier, rest);
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
    return this.supplierRepo.save(supplier);
  }

  async deleteSupplier(id: string, user: User): Promise<void> {
    this.requireAdmin(user);
    const supplier = await this.findSupplier(id);
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
