import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import { Request } from "express";
import { MaterialListsService } from "./material-lists.service";
import { AddMaterialDto } from "./material-list.dto";
import { AuthService } from "../auth/auth.service";

@Controller("proposals/:proposalId/materials")
export class MaterialListsController {
  constructor(
    private readonly materialListsService: MaterialListsService,
    private readonly authService: AuthService,
  ) {}

  private async requireUser(req: Request) {
    const userId = (req as any).cookies?.["dekorama_session"];
    if (!userId) throw new UnauthorizedException();
    const user = await this.authService.findById(userId);
    if (!user) throw new UnauthorizedException();
    return user;
  }

  @Get()
  async list(@Param("proposalId") proposalId: string, @Req() req: Request) {
    await this.requireUser(req);
    return this.materialListsService.list(proposalId);
  }

  @Post()
  async add(
    @Param("proposalId") proposalId: string,
    @Body() body: AddMaterialDto,
    @Req() req: Request,
  ) {
    const user = await this.requireUser(req);
    return this.materialListsService.add(proposalId, body, user);
  }

  @Delete(":materialId")
  async remove(
    @Param("proposalId") proposalId: string,
    @Param("materialId") materialId: string,
    @Req() req: Request,
  ) {
    const user = await this.requireUser(req);
    await this.materialListsService.remove(proposalId, materialId, user);
    return { ok: true };
  }
}
