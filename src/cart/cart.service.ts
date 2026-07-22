import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { CartItem } from "./cart.entity";
import { User, UserRole } from "../users/user.entity";
import { Product } from "../products/product.entity";
import {
  Proposal,
  ProposalStatus,
  ProposalType,
} from "../proposals/proposal.entity";
import { MaterialList } from "../material-lists/material-list.entity";
import { AddToCartDto, SubmitSolicitudDto, UpdateCartItemDto } from "./cart.dto";
import { ProjectsService } from "../projects/projects.service";

@Injectable()
export class CartService {
  constructor(
    @InjectRepository(CartItem)
    private readonly cartRepo: Repository<CartItem>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(Proposal)
    private readonly proposalRepo: Repository<Proposal>,
    @InjectRepository(MaterialList)
    private readonly materialListRepo: Repository<MaterialList>,
    private readonly projectsService: ProjectsService,
  ) {}

  async list(userId: string): Promise<CartItem[]> {
    return this.cartRepo.find({
      where: { userId },
      order: { addedAt: "DESC" },
    });
  }

  async addItem(
    userId: string,
    dto: AddToCartDto,
    options?: { unitPrice?: number },
  ): Promise<CartItem> {
    // Validate product exists
    const product = await this.productRepo.findOne({
      where: { sku: dto.productSku },
    });

    if (!product) {
      throw new NotFoundException(`Product with SKU ${dto.productSku} not found`);
    }

    if (!product.isActive) {
      throw new BadRequestException("Product is not available");
    }

    // Check if item already exists in cart
    const existingItem = await this.cartRepo.findOne({
      where: { userId, productSku: dto.productSku },
    });

    if (existingItem) {
      existingItem.quantity += dto.quantity;
      const saved = await this.cartRepo.save(existingItem);
      return (
        (await this.cartRepo.findOne({ where: { id: saved.id } })) ?? saved
      );
    }

    // Quote-first: default unitPrice 0; signed-proposal import passes price
    const cartItem = this.cartRepo.create({
      userId,
      productSku: dto.productSku,
      quantity: dto.quantity,
      unitPrice: options?.unitPrice !== undefined ? options.unitPrice : 0,
    });

    const saved = await this.cartRepo.save(cartItem);
    return (await this.cartRepo.findOne({ where: { id: saved.id } })) ?? saved;
  }

  async updateItem(
    itemId: string,
    userId: string,
    dto: UpdateCartItemDto,
  ): Promise<CartItem> {
    const item = await this.cartRepo.findOne({
      where: { id: itemId, userId },
    });

    if (!item) {
      throw new NotFoundException("Cart item not found");
    }

    item.quantity = dto.quantity;
    return this.cartRepo.save(item);
  }

  async removeItem(itemId: string, userId: string): Promise<void> {
    const item = await this.cartRepo.findOne({
      where: { id: itemId, userId },
    });

    if (!item) {
      throw new NotFoundException("Cart item not found");
    }

    await this.cartRepo.remove(item);
  }

  async clear(userId: string): Promise<void> {
    await this.cartRepo.delete({ userId });
  }

  async importFromProposal(
    proposalId: string,
    requestingUser: User,
  ): Promise<{ cartItems: CartItem[]; totalAmount: number }> {
    // Fetch proposal with relations
    const proposal = await this.proposalRepo.findOne({
      where: { id: proposalId },
      relations: ["project"],
    });

    if (!proposal) {
      throw new NotFoundException("Proposal not found");
    }

    // Verify user is the project owner
    if (proposal.project?.clientId !== requestingUser.id) {
      throw new ForbiddenException(
        "Only the project owner can import proposal materials",
      );
    }

    // Only allow importing from signed proposals
    if (proposal.status !== ProposalStatus.SIGNED) {
      throw new BadRequestException(
        "Can only import materials from signed proposals",
      );
    }

    // Fetch materials from proposal
    const materials = await this.materialListRepo.find({
      where: { proposalId },
    });

    if (materials.length === 0) {
      throw new BadRequestException("Proposal has no materials to import");
    }

    // Add each material to cart
    const cartItems: CartItem[] = [];
    for (const material of materials) {
      const product = await this.productRepo.findOne({
        where: { sku: material.productSku },
      });

      if (!product || !product.isActive) {
        console.warn(
          `Skipping inactive/missing product ${material.productSku}`,
        );
        continue;
      }

      const cartItem = await this.addItem(
        requestingUser.id,
        {
          productSku: material.productSku,
          quantity: material.quantity,
        },
        { unitPrice: Number(material.suggestedPrice) },
      );

      cartItems.push(cartItem);
    }

    // Calculate total
    const totalAmount = cartItems.reduce(
      (sum, item) => sum + +item.unitPrice * item.quantity,
      0,
    );

    return { cartItems, totalAmount };
  }

  async importFromProject(
    projectId: string,
    requestingUser: User,
  ): Promise<{ cartItems: CartItem[]; totalAmount: number }> {
    const projectProducts = await this.projectsService.listProducts(
      projectId,
      requestingUser,
    );

    if (projectProducts.length === 0) {
      throw new BadRequestException(
        "El proyecto no tiene productos para importar al carrito",
      );
    }

    const cartItems: CartItem[] = [];
    for (const projectProduct of projectProducts) {
      const product = await this.productRepo.findOne({
        where: { sku: projectProduct.productSku },
      });

      if (!product || !product.isActive) {
        console.warn(
          `Skipping inactive/missing product ${projectProduct.productSku}`,
        );
        continue;
      }

      const cartItem = await this.addItem(requestingUser.id, {
        productSku: projectProduct.productSku,
        quantity: projectProduct.quantity,
      });

      cartItems.push(cartItem);
    }

    if (cartItems.length === 0) {
      throw new BadRequestException(
        "Ningún producto del proyecto está disponible en el catálogo",
      );
    }

    const totalAmount = cartItems.reduce(
      (sum, item) => sum + +item.unitPrice * item.quantity,
      0,
    );

    return { cartItems, totalAmount };
  }

  async submitSolicitud(
    user: User,
    dto: SubmitSolicitudDto,
  ): Promise<Proposal> {
    if (user.role !== UserRole.CLIENT && user.role !== UserRole.PROFESSIONAL) {
      throw new ForbiddenException("Solo clientes y profesionales pueden enviar solicitudes");
    }

    const cartItems = await this.cartRepo.find({ where: { userId: user.id } });
    if (cartItems.length === 0) {
      throw new BadRequestException("El carrito está vacío");
    }

    let projectId: string | null = null;
    if (dto.projectId) {
      await this.projectsService.findOne(dto.projectId, user);
      projectId = dto.projectId;
    }

    const proposal = this.proposalRepo.create({
      type: ProposalType.SOLICITUD,
      projectId,
      clientId: user.id,
      createdById: user.id,
      laborCost: 0,
      message: dto.message ?? null,
      status: ProposalStatus.SOLICITUD_SUBMITTED,
    });
    const saved = await this.proposalRepo.save(proposal);

    for (const item of cartItems) {
      const product = await this.productRepo.findOneBy({ sku: item.productSku });
      if (!product) continue;

      await this.materialListRepo.save(
        this.materialListRepo.create({
          proposalId: saved.id,
          productSku: item.productSku,
          productName: product.name,
          quantity: item.quantity,
          suggestedPrice: item.unitPrice,
        }),
      );
    }

    await this.cartRepo.delete({ userId: user.id });
    return saved;
  }
}
