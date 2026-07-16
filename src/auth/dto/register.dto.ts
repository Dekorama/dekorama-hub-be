import { AccountType, UserRole } from "../../users/user.entity";
import { MarketCode, isMarketCode } from "../../common/market";

export class RegisterDto {
  name!: string;
  email!: string;
  password!: string;
  role!: UserRole.PROFESSIONAL | UserRole.CLIENT;
  accountType?: AccountType.INDIVIDUAL | AccountType.COMMUNITY;
  country!: MarketCode;
  profileData?: Record<string, unknown>;
}


