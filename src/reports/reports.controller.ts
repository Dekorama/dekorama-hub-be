import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ReportsService } from "./reports.service";
import { SessionGuard } from "../auth/guards/session.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { UserRole } from "../users/user.entity";
import { parseMarketFilter } from "../common/market-filter";

@Controller("admin/reports")
@UseGuards(SessionGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get("dashboard")
  dashboard(@Query("market") market?: string) {
    return this.reportsService.getDashboard(parseMarketFilter(market));
  }

  @Get("sales")
  sales(
    @Query("startDate") startDate: string,
    @Query("endDate") endDate: string,
    @Query("groupBy") groupBy: "day" | "week" | "month" = "month",
    @Query("market") market?: string,
  ) {
    return this.reportsService.getSalesReport(
      startDate,
      endDate,
      groupBy,
      parseMarketFilter(market),
    );
  }

  @Get("top-products")
  topProducts(@Query("limit") limit?: string, @Query("market") market?: string) {
    return this.reportsService.getTopProducts(
      limit ? parseInt(limit, 10) : 10,
      parseMarketFilter(market),
    );
  }

  @Get("suppliers")
  suppliers(@Query("market") market?: string) {
    return this.reportsService.getSuppliersReport(parseMarketFilter(market));
  }

  @Get("conversion")
  conversion(@Query("market") market?: string) {
    return this.reportsService.getConversionReport(parseMarketFilter(market));
  }
}
