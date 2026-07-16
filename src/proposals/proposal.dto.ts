import { ProposalStatus } from "./proposal.entity";
import { ProposalCommentVisibility } from "./entities/proposal-comment.entity";

export class CreateProposalDepartmentDto {
  projectDepartmentId!: string;
  partialLaborCost!: number;
  estimatedDays?: number;
}

export class CreateProposalMaterialDto {
  dekoramaSku!: string;
  quantity!: number;
  suggestedPrice?: number;
  productName?: string;
}

export class CreateProposalDto {
  departments!: CreateProposalDepartmentDto[];
  materials!: CreateProposalMaterialDto[];
  message?: string;
}

export class CreateDirectSaleDto {
  clientId!: string;
  materials!: CreateProposalMaterialDto[];
  laborCost?: number;
  message?: string;
}

export class ManualMaterialDto {
  productSku!: string;
  productName?: string;
  quantity!: number;
  suggestedPrice?: number;
}

export class ManualSectionDto {
  name!: string;
  sortOrder?: number;
  materials!: ManualMaterialDto[];
}

export class CreateManualProposalDto {
  clientId!: string;
  title?: string;
  taxRate?: number | null;
  laborCost?: number;
  message?: string;
  externalComment?: string;
  internalComment?: string;
  sections?: ManualSectionDto[];
  materials?: ManualMaterialDto[];
}

export class UpdateManualProposalDto {
  clientId?: string;
  title?: string | null;
  taxRate?: number | null;
  laborCost?: number;
  message?: string | null;
  sections?: ManualSectionDto[];
  materials?: ManualMaterialDto[];
}

export class UpdateMaterialItemDto {
  productSku!: string;
  productName!: string;
  quantity!: number;
  suggestedPrice!: number;
  sectionId?: string | null;
}

export class UpdateMaterialListDto {
  materials!: UpdateMaterialItemDto[];
}

export class UpdateProposalStatusDto {
  status!: ProposalStatus.REJECTED;
}

export class SubmitSolicitudDto {
  message?: string;
}

export class CreateProposalCommentDto {
  content!: string;
  visibility!: ProposalCommentVisibility;
}
