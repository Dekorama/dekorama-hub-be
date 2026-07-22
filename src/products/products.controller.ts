import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import { Request } from "express";
import { ProductsService } from "./products.service";
import {
  CreateProductDto,
  UpdateProductDto,
  CreateFamilyDto,
  CreateSubfamilyDto,
  UpdateFamilyDto,
  UpdateSubfamilyDto,
} from "./product.dto";
import { toProductDto, toProductDtoList } from "./product.mapper";
import { AuthService } from "../auth/auth.service";
import { readSessionUserId } from "../auth/session";
import { UserRole } from "../users/user.entity";
import { parseMarketFilter } from "../common/market-filter";

@Controller("products")
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly authService: AuthService,
  ) {}

  private async requireUser(req: Request) {
    const userId = readSessionUserId(req);
    if (!userId) throw new UnauthorizedException();
    const user = await this.authService.findById(userId);
    if (!user) throw new UnauthorizedException();
    return user;
  }

  private assertVisible(product: { isActive: boolean }, role: UserRole) {
    if (role !== UserRole.ADMIN && !product.isActive) {
      throw new NotFoundException("Producto no encontrado");
    }
  }

  @Get()
  async list(
    @Query("search") search: string,
    @Query("family") family: string,
    @Query("subfamily") subfamily: string,
    @Query("supplierId") supplierId: string,
    @Query("market") marketQuery: string,
    @Query("page") pageQuery: string,
    @Query("limit") limitQuery: string,
    @Req() req: Request,
  ) {
    const user = await this.requireUser(req);
    const isAdmin = user.role === UserRole.ADMIN;
    const market = isAdmin ? parseMarketFilter(marketQuery) : user.country;
    const page = pageQuery ? Math.max(1, parseInt(pageQuery, 10) || 1) : undefined;
    const limit = pageQuery
      ? Math.min(100, Math.max(1, parseInt(limitQuery, 10) || 24))
      : undefined;

    const result = await this.productsService.list({
      search,
      family,
      subfamily,
      supplierId,
      market,
      activeOnly: !isAdmin,
      page,
      limit,
    });

    if (Array.isArray(result)) {
      return toProductDtoList(result, user.role);
    }

    return {
      items: toProductDtoList(result.items, user.role),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }

  @Get("catalog-filters")
  async getCatalogFilters(@Req() req: Request) {
    const user = await this.requireUser(req);
    const market =
      user.role === UserRole.ADMIN ? undefined : user.country;
    return this.productsService.getCatalogFilters(market);
  }

  @Get("families/all")
  async getFamilies(@Req() req: Request) {
    await this.requireUser(req);
    return this.productsService.getFamilies();
  }

  @Get("subfamilies/all")
  async getSubfamilies(
    @Query("family") family: string,
    @Req() req: Request,
  ) {
    await this.requireUser(req);
    return this.productsService.getSubfamilies(family);
  }

  @Post("families")
  async createFamily(@Body() body: CreateFamilyDto, @Req() req: Request) {
    const user = await this.requireUser(req);
    return this.productsService.createFamily(body, user);
  }

  @Patch("families/:code")
  async updateFamily(
    @Param("code") code: string,
    @Body() body: UpdateFamilyDto,
    @Req() req: Request,
  ) {
    const user = await this.requireUser(req);
    return this.productsService.updateFamily(code, body, user);
  }

  @Post("subfamilies")
  async createSubfamily(@Body() body: CreateSubfamilyDto, @Req() req: Request) {
    const user = await this.requireUser(req);
    return this.productsService.createSubfamily(body, user);
  }

  @Patch("subfamilies/:code")
  async updateSubfamily(
    @Param("code") code: string,
    @Body() body: UpdateSubfamilyDto,
    @Req() req: Request,
  ) {
    const user = await this.requireUser(req);
    return this.productsService.updateSubfamily(code, body, user);
  }

  @Delete("families/:code")
  async deleteFamily(@Param("code") code: string, @Req() req: Request) {
    const user = await this.requireUser(req);
    await this.productsService.deleteFamily(code, user);
    return { ok: true };
  }

  @Delete("subfamilies/:code")
  async deleteSubfamily(@Param("code") code: string, @Req() req: Request) {
    const user = await this.requireUser(req);
    await this.productsService.deleteSubfamily(code, user);
    return { ok: true };
  }

  @Get("sku/:sku")
  async findBySku(@Param("sku") sku: string, @Req() req: Request) {
    const user = await this.requireUser(req);
    const product = await this.productsService.findBySku(sku);
    this.assertVisible(product, user.role);
    return toProductDto(product, user.role);
  }

  @Get(":id")
  async findOne(@Param("id") id: string, @Req() req: Request) {
    const user = await this.requireUser(req);
    const product = await this.productsService.findOne(id);
    this.assertVisible(product, user.role);
    return toProductDto(product, user.role);
  }

  @Post()
  async create(@Body() body: CreateProductDto, @Req() req: Request) {
    const user = await this.requireUser(req);
    const saved = await this.productsService.create(body, user);
    return toProductDto(saved, user.role);
  }

  @Patch(":id")
  async update(
    @Param("id") id: string,
    @Body() body: UpdateProductDto,
    @Req() req: Request,
  ) {
    const user = await this.requireUser(req);
    const saved = await this.productsService.update(id, body, user);
    return toProductDto(saved, user.role);
  }

  @Delete(":id")
  async remove(@Param("id") id: string, @Req() req: Request) {
    const user = await this.requireUser(req);
    await this.productsService.remove(id, user);
    return { ok: true };
  }
}
