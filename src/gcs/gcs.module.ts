import { Module } from "@nestjs/common";
import { GcsService } from "./gcs.service";
import { UploadsController } from "./uploads.controller";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule],
  controllers: [UploadsController],
  providers: [GcsService],
  exports: [GcsService],
})
export class GcsModule {}
