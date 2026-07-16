import { MarketCode } from "../../common/market";

export class CreateClientDto {
  name!: string;
  email!: string;
  password?: string;
  country!: MarketCode;
  profileData?: Record<string, unknown>;
  taxRate?: number | null;
  taxExempt?: boolean;
}
