import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { MaterialList } from "./material-list.entity";
import { Proposal } from "../proposals/proposal.entity";
import { MaterialListsService } from "./material-lists.service";
import { MaterialListsController } from "./material-lists.controller";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [TypeOrmModule.forFeature([MaterialList, Proposal]), AuthModule],
  controllers: [MaterialListsController],
  providers: [MaterialListsService],
})
export class MaterialListsModule {}
