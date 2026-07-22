import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Storage, Bucket } from "@google-cloud/storage";
import { randomUUID } from "crypto";

export type GcsBucketKind = "products" | "invoices";

@Injectable()
export class GcsService {
  private readonly logger = new Logger(GcsService.name);
  private readonly storage: Storage | null;
  private readonly productsBucketName: string;
  private readonly invoicesBucketName: string;

  constructor(private readonly config: ConfigService) {
    const projectId = this.config.get<string>("GCS_PROJECT_ID")?.trim();
    this.productsBucketName =
      this.config.get<string>("GCS_PRODUCTS_BUCKET")?.trim() ?? "";
    this.invoicesBucketName =
      this.config.get<string>("GCS_INVOICES_BUCKET")?.trim() ?? "";

    if (!projectId || !this.productsBucketName || !this.invoicesBucketName) {
      this.storage = null;
      this.logger.warn(
        "GCS not configured (GCS_PROJECT_ID / GCS_PRODUCTS_BUCKET / GCS_INVOICES_BUCKET). Uploads disabled.",
      );
      return;
    }

    const credentialsJson = this.config.get<string>("GCS_CREDENTIALS_JSON")?.trim();
    const keyFilename = this.config.get<string>("GCS_KEY_FILE")?.trim();

    if (credentialsJson) {
      this.storage = new Storage({
        projectId,
        credentials: JSON.parse(credentialsJson) as Record<string, unknown>,
      });
    } else if (keyFilename) {
      this.storage = new Storage({ projectId, keyFilename });
    } else {
      this.storage = new Storage({ projectId });
    }
  }

  isConfigured(): boolean {
    return this.storage !== null;
  }

  private requireStorage(): Storage {
    if (!this.storage) {
      throw new ServiceUnavailableException(
        "Google Cloud Storage no está configurado",
      );
    }
    return this.storage;
  }

  private bucket(kind: GcsBucketKind): Bucket {
    const name =
      kind === "products" ? this.productsBucketName : this.invoicesBucketName;
    return this.requireStorage().bucket(name);
  }

  private sanitizeFilename(original: string): string {
    const base = original.split(/[/\\]/).pop() ?? "file";
    const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
    return cleaned.length > 0 ? cleaned : "file";
  }

  private assertMime(
    mimetype: string,
    allowed: readonly string[],
    label: string,
  ): void {
    if (!allowed.includes(mimetype)) {
      throw new BadRequestException(
        `${label}: tipo no permitido (${mimetype}). Permitidos: ${allowed.join(", ")}`,
      );
    }
  }

  async uploadProductImage(
    file: Express.Multer.File,
  ): Promise<{ url: string; objectPath: string }> {
    this.assertMime(
      file.mimetype,
      ["image/jpeg", "image/png", "image/webp", "image/gif"],
      "Imagen de producto",
    );
    if (file.size > 8 * 1024 * 1024) {
      throw new BadRequestException("Imagen demasiado grande (máx 8 MB)");
    }

    const objectPath = `products/${Date.now()}-${randomUUID().slice(0, 8)}-${this.sanitizeFilename(file.originalname)}`;
    const bucket = this.bucket("products");
    const blob = bucket.file(objectPath);

    await blob.save(file.buffer, {
      resumable: false,
      contentType: file.mimetype,
      metadata: {
        cacheControl: "public, max-age=31536000",
      },
    });

    const url = `https://storage.googleapis.com/${this.productsBucketName}/${objectPath}`;
    return { url, objectPath };
  }

  async uploadSupplierInvoicePdf(
    file: Express.Multer.File,
  ): Promise<{ objectPath: string }> {
    this.assertMime(file.mimetype, ["application/pdf"], "Factura proveedor");
    if (file.size > 20 * 1024 * 1024) {
      throw new BadRequestException("PDF demasiado grande (máx 20 MB)");
    }

    const objectPath = `suppliers/${Date.now()}-${randomUUID().slice(0, 8)}-${this.sanitizeFilename(file.originalname)}`;
    await this.bucket("invoices")
      .file(objectPath)
      .save(file.buffer, {
        resumable: false,
        contentType: "application/pdf",
        metadata: { cacheControl: "private, max-age=0" },
      });

    return { objectPath };
  }

  async uploadClientInvoicePdf(
    invoiceNumber: string,
    buffer: Buffer,
  ): Promise<{ objectPath: string }> {
    const safeNumber = invoiceNumber.replace(/[^a-zA-Z0-9._-]/g, "_");
    const objectPath = `client/${safeNumber}.pdf`;
    await this.bucket("invoices")
      .file(objectPath)
      .save(buffer, {
        resumable: false,
        contentType: "application/pdf",
        metadata: { cacheControl: "private, max-age=0" },
      });

    return { objectPath };
  }

  async getSignedUrl(
    kind: GcsBucketKind,
    objectPath: string,
    expiresInMinutes = 60,
  ): Promise<string> {
    const [url] = await this.bucket(kind)
      .file(objectPath)
      .getSignedUrl({
        version: "v4",
        action: "read",
        expires: Date.now() + expiresInMinutes * 60 * 1000,
      });
    return url;
  }

  async downloadBuffer(
    kind: GcsBucketKind,
    objectPath: string,
  ): Promise<Buffer> {
    const [buf] = await this.bucket(kind).file(objectPath).download();
    return buf;
  }

  async exists(kind: GcsBucketKind, objectPath: string): Promise<boolean> {
    const [ok] = await this.bucket(kind).file(objectPath).exists();
    return ok;
  }
}
