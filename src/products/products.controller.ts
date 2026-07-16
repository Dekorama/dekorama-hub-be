import {
  Body,
  Controller,
  Delete,
  Get,
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

  @Get()
  async list(
    @Query("search") search: string,
    @Query("family") family: string,
    @Query("subfamily") subfamily: string,
    @Query("market") marketQuery: string,
    @Req() req: Request,
  ) {
    const user = await this.requireUser(req);
    const market =
      user.role === UserRole.ADMIN
        ? parseMarketFilter(marketQuery)
        : user.country;
    return this.productsService.list(search, family, subfamily, market);
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

  @Get(":id")
  async findOne(@Param("id") id: string, @Req() req: Request) {
    await this.requireUser(req);
    return this.productsService.findOne(id);
  }

  @Post()
  async create(@Body() body: CreateProductDto, @Req() req: Request) {
    const user = await this.requireUser(req);
    return this.productsService.create(body, user);
  }

  @Patch(":id")
  async update(
    @Param("id") id: string,
    @Body() body: UpdateProductDto,
    @Req() req: Request,
  ) {
    const user = await this.requireUser(req);
    return this.productsService.update(id, body, user);
  }

  @Delete(":id")
  async remove(@Param("id") id: string, @Req() req: Request) {
    const user = await this.requireUser(req);
    await this.productsService.remove(id, user);
    return { ok: true };
  }
}
