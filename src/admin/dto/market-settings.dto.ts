import { MarketCode } from "../../common/market";

export class MarketSettingsResponseDto {
  code!: MarketCode;
  label!: string;
  storeName!: string;
  taxRate!: number;
  taxLabel!: string;
  currency!: string;
  locale!: string;
  docLabel!: string;
  paymentMethods!: string[];
  updatedAt!: Date;
}

export class UpdateMarketSettingsDto {
  label?: string;
  storeName?: string;
  taxRate?: number;
  taxLabel?: string;
  currency?: string;
  locale?: string;
  docLabel?: string;
  paymentMethods?: string[];
}
