import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  Delete,
} from "@nestjs/common";
import { ProfessionalDocumentsService } from "./professional-documents.service";
import {
  UploadDocumentDto,
  RejectDocumentDto,
} from "./professional-document.dto";
import { CreatePortfolioDto, CreateProductTagDto } from "./dto/portfolio.dto";
import { SessionGuard } from "../auth/guards/session.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { VerifiedProfessionalGuard } from "../auth/guards/verified-professional.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/user.decorator";
import { User, UserRole } from "../users/user.entity";

@Controller("professional-documents")
@UseGuards(SessionGuard)
export class ProfessionalDocumentsController {
  constructor(
    private readonly service: ProfessionalDocumentsService,
  ) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.PROFESSIONAL)
  async uploadDocument(
    @Body() dto: UploadDocumentDto,
    @CurrentUser() user: User,
  ) {
    return this.service.uploadDocument(user, dto);
  }

  @Get("pending")
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async getPendingVerifications() {
    return this.service.getPendingVerifications();
  }

  @Get("user/:userId")
  async getDocumentsByUser(@Param("userId") userId: string) {
    return this.service.getDocumentsByUser(userId);
  }

  @Patch(":id/approve")
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async approveDocument(@Param("id") id: string) {
    return this.service.approveDocument(id);
  }

  @Patch(":id/reject")
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async rejectDocument(
    @Param("id") id: string,
    @Body() dto: RejectDocumentDto,
  ) {
    return this.service.rejectDocument(id, dto.rejectionReason);
  }

  // Portfolio Endpoints

  @Post("portfolio")
  @UseGuards(VerifiedProfessionalGuard)
  async createPortfolio(
    @Body() dto: CreatePortfolioDto,
    @CurrentUser() user: User,
  ) {
    return this.service.createPortfolio(user, dto);
  }

  @Get("portfolio/:userId")
  async listPortfolios(@Param("userId") userId: string) {
    return this.service.listPortfolios(userId);
  }

  @Post("portfolio/:portfolioId/tags")
  @UseGuards(SessionGuard)
  async addProductTag(
    @Param("portfolioId") portfolioId: string,
    @Body() dto: CreateProductTagDto,
    @CurrentUser() user: User,
  ) {
    return this.service.addProductTag(portfolioId, dto, user);
  }

  @Delete("portfolio/:portfolioId")
  @UseGuards(SessionGuard)
  async deletePortfolio(
    @Param("portfolioId") portfolioId: string,
    @CurrentUser() user: User,
  ) {
    return this.service.deletePortfolio(portfolioId, user);
  }
}

