import { IsEnum, IsNotEmpty, IsString } from "class-validator";
import { DocumentType } from "./professional-document.entity";

export class UploadDocumentDto {
  @IsEnum(DocumentType)
  @IsNotEmpty()
  documentType!: DocumentType;

  @IsString()
  @IsNotEmpty()
  fileUrl!: string;
}

export class ApproveDocumentDto {
  // No fields needed, just the action
}

export class RejectDocumentDto {
  @IsString()
  @IsNotEmpty()
  rejectionReason!: string;
}
