import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { GcsService } from "./gcs.service";
import { SessionGuard } from "../auth/guards/session.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { UserRole } from "../users/user.entity";

@Controller("uploads")
@UseGuards(SessionGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class UploadsController {
  constructor(private readonly gcs: GcsService) {}

  @Post("products")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: 8 * 1024 * 1024 },
    }),
  )
  async uploadProductImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException("Archivo requerido (campo file)");
    const result = await this.gcs.uploadProductImage(file);
    return { url: result.url, objectPath: result.objectPath };
  }

  @Post("invoices/supplier")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: 20 * 1024 * 1024 },
    }),
  )
  async uploadSupplierInvoice(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException("Archivo requerido (campo file)");
    const result = await this.gcs.uploadSupplierInvoicePdf(file);
    return { fileUrl: result.objectPath, objectPath: result.objectPath };
  }
}
