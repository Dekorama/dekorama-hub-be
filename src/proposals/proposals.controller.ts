import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
} from "@nestjs/common";
import { Request, Response } from "express";
import { ProposalsService } from "./proposals.service";
import {
  CreateDirectSaleDto,
  CreateManualProposalDto,
  CreateProposalCommentDto,
  CreateProposalDto,
  UpdateManualProposalDto,
  UpdateMaterialListDto,
  UpdateProposalStatusDto,
} from "./proposal.dto";
import { AuthService } from "../auth/auth.service";
import { readSessionUserId } from "../auth/session";
import { parseMarketFilter } from "../common/market-filter";
import { ProposalStatus } from "./proposal.entity";

@Controller()
export class ProposalsController {
  constructor(
    private readonly proposalsService: ProposalsService,
    private readonly authService: AuthService,
  ) {}

  private async requireUser(req: Request) {
    const userId = readSessionUserId(req);
    if (!userId) throw new UnauthorizedException();
    const user = await this.authService.findById(userId);
    if (!user) throw new UnauthorizedException();
    return user;
  }

  @Get("proposals/mine")
  async listMine(@Req() req: Request) {
    const user = await this.requireUser(req);
    return this.proposalsService.listMine(user);
  }

  @Get("proposals/solicitudes")
  async listSolicitudes(@Query("market") market: string, @Req() req: Request) {
    const user = await this.requireUser(req);
    return this.proposalsService.listSolicitudes(user, parseMarketFilter(market));
  }

  @Get("proposals/:id/proforma.pdf")
  async getProformaPdf(
    @Param("id") id: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const user = await this.requireUser(req);
    const buffer = await this.proposalsService.generateProformaPdf(id, user);
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="proforma-${id}.pdf"`,
      "Content-Length": buffer.length,
    });
    res.end(buffer);
  }

  @Get("proposals/:id/materials")
  async getMaterials(@Param("id") id: string, @Req() req: Request) {
    const user = await this.requireUser(req);
    return this.proposalsService.getMaterials(id, user);
  }

  @Get("proposals/:id/sections")
  async getSections(@Param("id") id: string, @Req() req: Request) {
    await this.requireUser(req);
    return this.proposalsService.getSections(id);
  }

  @Get("proposals/:id/comments")
  async listComments(@Param("id") id: string, @Req() req: Request) {
    const user = await this.requireUser(req);
    return this.proposalsService.listComments(id, user);
  }

  @Post("proposals/:id/comments")
  async addComment(
    @Param("id") id: string,
    @Body() body: CreateProposalCommentDto,
    @Req() req: Request,
  ) {
    const user = await this.requireUser(req);
    return this.proposalsService.addComment(id, body, user);
  }

  @Get("proposals/:id")
  async getOne(@Param("id") id: string, @Req() req: Request) {
    const user = await this.requireUser(req);
    return this.proposalsService.findOne(id, user);
  }

  @Get("projects/:projectId/proposals")
  async list(@Param("projectId") projectId: string, @Req() req: Request) {
    const user = await this.requireUser(req);
    return this.proposalsService.listByProject(projectId, user);
  }

  @Post("proposals/manual")
  async createManual(@Body() body: CreateManualProposalDto, @Req() req: Request) {
    const user = await this.requireUser(req);
    return this.proposalsService.createManual(body, user);
  }

  @Post("proposals/direct-sale")
  async createDirectSale(@Body() body: CreateDirectSaleDto, @Req() req: Request) {
    const user = await this.requireUser(req);
    return this.proposalsService.createDirectSale(body, user);
  }

  @Post("projects/:projectId/proposals")
  async create(
    @Param("projectId") projectId: string,
    @Body() body: CreateProposalDto,
    @Req() req: Request,
  ) {
    const user = await this.requireUser(req);
    return this.proposalsService.create(projectId, body, user);
  }

  @Patch("proposals/:id/materials")
  async updateMaterials(
    @Param("id") id: string,
    @Body() body: UpdateMaterialListDto,
    @Req() req: Request,
  ) {
    const user = await this.requireUser(req);
    return this.proposalsService.updateMaterials(id, body, user);
  }

  @Patch("proposals/:id/ready")
  async submitProforma(@Param("id") id: string, @Req() req: Request) {
    const user = await this.requireUser(req);
    return this.proposalsService.submitProforma(id, user);
  }

  @Post("proposals/:id/send-proforma")
  async sendProforma(@Param("id") id: string, @Req() req: Request) {
    const user = await this.requireUser(req);
    return this.proposalsService.sendProformaEmail(id, user);
  }

  @Patch("proposals/:id/sign")
  async sign(@Param("id") id: string, @Req() req: Request) {
    const user = await this.requireUser(req);
    return this.proposalsService.sign(id, user);
  }

  @Patch("proposals/:id")
  async update(
    @Param("id") id: string,
    @Body() body: UpdateProposalStatusDto | UpdateManualProposalDto,
    @Req() req: Request,
  ) {
    const user = await this.requireUser(req);
    if (
      "status" in body &&
      body.status === ProposalStatus.REJECTED &&
      Object.keys(body).length === 1
    ) {
      return this.proposalsService.updateStatus(id, body as UpdateProposalStatusDto, user);
    }
    return this.proposalsService.updateManual(id, body as UpdateManualProposalDto, user);
  }
}
