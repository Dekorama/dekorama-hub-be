export enum MarketCode {
  VE = "VE",
  ES = "ES",
}

export interface MarketConfig {
  code: MarketCode;
  label: string;
  storeName: string;
  taxRate: number;
  taxLabel: string;
  currency: string;
  locale: string;
  docLabel: string;
  paymentMethods: string[];
}

export const MARKETS: Record<MarketCode, MarketConfig> = {
  [MarketCode.VE]: {
    code: MarketCode.VE,
    label: "Venezuela",
    storeName: "Dekorama Venezuela",
    taxRate: 16,
    taxLabel: "IVA",
    currency: "USD",
    locale: "es-VE",
    docLabel: "RIF",
    paymentMethods: ["Pagomovil", "Zelle", "Transferencia"],
  },
  [MarketCode.ES]: {
    code: MarketCode.ES,
    label: "España",
    storeName: "Dekorama España",
    taxRate: 21,
    taxLabel: "IVA",
    currency: "EUR",
    locale: "es-ES",
    docLabel: "NIF/CIF",
    paymentMethods: ["Transferencia", "Tarjeta (próximamente)"],
  },
};

export const MARKET_CODES = Object.values(MarketCode);

export function isMarketCode(value: string): value is MarketCode {
  return MARKET_CODES.includes(value as MarketCode);
}

export function getMarketConfig(code: MarketCode): MarketConfig {
  return MARKETS[code];
}

export function getDefaultTaxRate(code: MarketCode): number {
  return MARKETS[code].taxRate;
}
