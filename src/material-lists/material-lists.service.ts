import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { MaterialList } from "./material-list.entity";
import { Proposal, ProposalStatus } from "../proposals/proposal.entity";
import { User } from "../users/user.entity";
import { AddMaterialDto } from "./material-list.dto";

@Injectable()
export class MaterialListsService {
  constructor(
    @InjectRepository(MaterialList)
    private readonly repo: Repository<MaterialList>,
    @InjectRepository(Proposal)
    private readonly proposalsRepo: Repository<Proposal>,
  ) {}

  async list(proposalId: string): Promise<MaterialList[]> {
    return this.repo.find({ where: { proposalId } });
  }

  async add(proposalId: string, dto: AddMaterialDto, user: User): Promise<MaterialList> {
    const proposal = await this.proposalsRepo.findOneBy({ id: proposalId });
    if (!proposal) throw new NotFoundException("Propuesta no encontrada");
    if (proposal.professionalId !== user.id) {
      throw new ForbiddenException("Solo el autor de la propuesta puede agregar materiales");
    }
    if (proposal.status !== ProposalStatus.PENDING) {
      throw new BadRequestException("No se pueden modificar materiales de una proforma ya finalizada");
    }
    const item = this.repo.create({ proposalId, ...dto });
    return this.repo.save(item);
  }

  async remove(proposalId: string, materialId: string, user: User): Promise<void> {
    const proposal = await this.proposalsRepo.findOneBy({ id: proposalId });
    if (!proposal) throw new NotFoundException("Propuesta no encontrada");
    if (proposal.professionalId !== user.id) {
      throw new ForbiddenException("Solo el autor de la propuesta puede eliminar materiales");
    }
    if (proposal.status !== ProposalStatus.PENDING) {
      throw new BadRequestException("No se pueden modificar materiales de una proforma ya finalizada");
    }
    const item = await this.repo.findOneBy({ id: materialId, proposalId });
    if (!item) throw new NotFoundException("Material no encontrado");
    await this.repo.remove(item);
  }
}
