import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  ProfessionalDocument,
  DocumentStatus,
} from "./professional-document.entity";
import { User, UserRole } from "../users/user.entity";
import { UploadDocumentDto } from "./professional-document.dto";
import { PortfolioProject } from "./entities/portfolio-project.entity";
import { ProductTag } from "./entities/product-tag.entity";
import { Product } from "../products/product.entity";
import { CreatePortfolioDto, CreateProductTagDto } from "./dto/portfolio.dto";

@Injectable()
export class ProfessionalDocumentsService {
  constructor(
    @InjectRepository(ProfessionalDocument)
    private readonly repo: Repository<ProfessionalDocument>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(PortfolioProject)
    private readonly portfolioRepo: Repository<PortfolioProject>,
    @InjectRepository(ProductTag)
    private readonly tagRepo: Repository<ProductTag>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
  ) {}

  async uploadDocument(
    user: User,
    dto: UploadDocumentDto,
  ): Promise<ProfessionalDocument> {
    if (user.role !== UserRole.PROFESSIONAL) {
      throw new BadRequestException("Only professionals can upload documents");
    }

    const document = this.repo.create({
      userId: user.id,
      documentType: dto.documentType,
      fileUrl: dto.fileUrl,
      status: DocumentStatus.PENDING,
    });

    return this.repo.save(document);
  }

  async getPendingVerifications(): Promise<ProfessionalDocument[]> {
    return this.repo.find({
      where: { status: DocumentStatus.PENDING },
      relations: ["user"],
      order: { createdAt: "ASC" },
    });
  }

  async getDocumentsByUser(userId: string): Promise<ProfessionalDocument[]> {
    return this.repo.find({
      where: { userId },
      order: { createdAt: "DESC" },
    });
  }

  async approveDocument(id: string): Promise<ProfessionalDocument> {
    const document = await this.repo.findOne({
      where: { id },
      relations: ["user"],
    });

    if (!document) {
      throw new NotFoundException("Document not found");
    }

    document.status = DocumentStatus.APPROVED;
    document.updatedAt = new Date();
    await this.repo.save(document);

    // Check if all documents for this user are approved
    const userDocuments = await this.repo.find({
      where: { userId: document.userId },
    });

    const allApproved = userDocuments.every(
      (doc) => doc.status === DocumentStatus.APPROVED,
    );

    if (allApproved && userDocuments.length > 0) {
      // Update user verification status
      await this.userRepo.update(document.userId, { isVerified: true });
      console.log(
        `✅ Professional ${document.user.email} verified (all documents approved)`,
      );
      // TODO Phase 2: Send email notification
    }

    return document;
  }

  async rejectDocument(
    id: string,
    reason: string,
  ): Promise<ProfessionalDocument> {
    const document = await this.repo.findOne({
      where: { id },
      relations: ["user"],
    });

    if (!document) {
      throw new NotFoundException("Document not found");
    }

    document.status = DocumentStatus.REJECTED;
    document.rejectionReason = reason;
    document.updatedAt = new Date();
    await this.repo.save(document);

    // Ensure user remains unverified
    await this.userRepo.update(document.userId, { isVerified: false });
    console.log(
      `❌ Document rejected for ${document.user.email}: ${reason}`,
    );
    // TODO Phase 2: Send email notification

    return document;
  }

  // Portfolio Methods

  async createPortfolio(
    user: User,
    dto: CreatePortfolioDto,
  ): Promise<PortfolioProject> {
    if (user.role !== UserRole.PROFESSIONAL || !user.isVerified) {
      throw new ForbiddenException(
        "Only verified professionals can create portfolios",
      );
    }

    const portfolio = this.portfolioRepo.create({
      professionalId: user.id,
      title: dto.title,
      description: dto.description ?? null,
      completionDate: new Date(dto.completionDate),
      images: dto.images,
    });

    return this.portfolioRepo.save(portfolio);
  }

  async listPortfolios(professionalId: string): Promise<PortfolioProject[]> {
    return this.portfolioRepo.find({
      where: { professionalId },
      order: { completionDate: "DESC" },
      relations: ["tags", "tags.product"],
    });
  }

  async addProductTag(
    portfolioId: string,
    dto: CreateProductTagDto,
    requestingUser: User,
  ): Promise<ProductTag> {
    // Verify portfolio exists and user owns it
    const portfolio = await this.portfolioRepo.findOne({
      where: { id: portfolioId },
    });

    if (!portfolio) {
      throw new NotFoundException("Portfolio project not found");
    }

    if (
      portfolio.professionalId !== requestingUser.id &&
      requestingUser.role !== UserRole.ADMIN
    ) {
      throw new ForbiddenException("You can only add tags to your own portfolio");
    }

    // Validate imageUrl exists in portfolio
    if (!portfolio.images.includes(dto.imageUrl)) {
      throw new BadRequestException(
        "Image URL must be one of the portfolio images",
      );
    }

    // Validate product exists
    const product = await this.productRepo.findOne({
      where: { sku: dto.productSku },
    });

    if (!product) {
      throw new NotFoundException(`Product with SKU ${dto.productSku} not found`);
    }

    // ponytail: Enforce max 5 tags per image (prevents cluttering)
    const existingTags = await this.tagRepo.count({
      where: { portfolioProjectId: portfolioId, imageUrl: dto.imageUrl },
    });

    if (existingTags >= 5) {
      throw new BadRequestException("Maximum 5 tags per image allowed");
    }

    const tag = this.tagRepo.create({
      portfolioProjectId: portfolioId,
      productSku: dto.productSku,
      imageUrl: dto.imageUrl,
      positionX: dto.positionX,
      positionY: dto.positionY,
    });

    return this.tagRepo.save(tag);
  }

  async deletePortfolio(
    portfolioId: string,
    requestingUser: User,
  ): Promise<void> {
    const portfolio = await this.portfolioRepo.findOne({
      where: { id: portfolioId },
    });

    if (!portfolio) {
      throw new NotFoundException("Portfolio project not found");
    }

    if (
      portfolio.professionalId !== requestingUser.id &&
      requestingUser.role !== UserRole.ADMIN
    ) {
      throw new ForbiddenException("You can only delete your own portfolio");
    }

    await this.portfolioRepo.remove(portfolio);
  }
}

