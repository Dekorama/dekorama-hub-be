import { Injectable, NotFoundException, OnModuleInit } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { MARKETS, MarketCode, MarketConfig, MARKET_CODES } from "../common/market";
import { MarketSettings } from "./entities/market-settings.entity";
import {
  MarketSettingsResponseDto,
  UpdateMarketSettingsDto,
} from "./dto/market-settings.dto";

@Injectable()
export class MarketSettingsService implements OnModuleInit {
  constructor(
    @InjectRepository(MarketSettings)
    private readonly repo: Repository<MarketSettings>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.seedDefaults();
  }

  async seedDefaults(): Promise<void> {
    for (const code of MARKET_CODES) {
      const existing = await this.repo.findOneBy({ code });
      if (existing) continue;

      const defaults = MARKETS[code];
      await this.repo.save(
        this.repo.create({
          code,
          label: defaults.label,
          storeName: defaults.storeName,
          taxRate: defaults.taxRate,
          taxLabel: defaults.taxLabel,
          currency: defaults.currency,
          locale: defaults.locale,
          docLabel: defaults.docLabel,
          paymentMethods: defaults.paymentMethods,
        }),
      );
    }
  }

  private toDto(row: MarketSettings): MarketSettingsResponseDto {
    return {
      code: row.code,
      label: row.label,
      storeName: row.storeName,
      taxRate: Number(row.taxRate),
      taxLabel: row.taxLabel,
      currency: row.currency,
      locale: row.locale,
      docLabel: row.docLabel,
      paymentMethods: row.paymentMethods ?? [],
      updatedAt: row.updatedAt,
    };
  }

  async listAll(): Promise<MarketSettingsResponseDto[]> {
    await this.seedDefaults();
    const rows = await this.repo.find({ order: { code: "ASC" } });
    return rows.map((row) => this.toDto(row));
  }

  async getByCode(code: MarketCode): Promise<MarketSettingsResponseDto> {
    await this.seedDefaults();
    const row = await this.repo.findOneBy({ code });
    if (!row) throw new NotFoundException(`Configuración de mercado ${code} no encontrada`);
    return this.toDto(row);
  }

  async getConfig(code: MarketCode): Promise<MarketConfig> {
    try {
      const dto = await this.getByCode(code);
      return {
        code: dto.code,
        label: dto.label,
        storeName: dto.storeName,
        taxRate: dto.taxRate,
        taxLabel: dto.taxLabel,
        currency: dto.currency,
        locale: dto.locale,
        docLabel: dto.docLabel,
        paymentMethods: dto.paymentMethods,
      };
    } catch {
      return MARKETS[code];
    }
  }

  async getDefaultTaxRate(code: MarketCode): Promise<number> {
    const config = await this.getConfig(code);
    return config.taxRate;
  }

  async update(
    code: MarketCode,
    dto: UpdateMarketSettingsDto,
  ): Promise<MarketSettingsResponseDto> {
    await this.seedDefaults();
    const row = await this.repo.findOneBy({ code });
    if (!row) throw new NotFoundException(`Configuración de mercado ${code} no encontrada`);

    if (dto.label !== undefined) row.label = dto.label;
    if (dto.storeName !== undefined) row.storeName = dto.storeName;
    if (dto.taxRate !== undefined) row.taxRate = dto.taxRate;
    if (dto.taxLabel !== undefined) row.taxLabel = dto.taxLabel;
    if (dto.currency !== undefined) row.currency = dto.currency;
    if (dto.locale !== undefined) row.locale = dto.locale;
    if (dto.docLabel !== undefined) row.docLabel = dto.docLabel;
    if (dto.paymentMethods !== undefined) row.paymentMethods = dto.paymentMethods;

    const saved = await this.repo.save(row);
    return this.toDto(saved);
  }
}
