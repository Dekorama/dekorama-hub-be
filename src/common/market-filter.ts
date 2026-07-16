import { MarketCode, isMarketCode } from "./market";

export function parseMarketFilter(value?: string): MarketCode | undefined {
  if (value && isMarketCode(value)) return value;
  return undefined;
}
