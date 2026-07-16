import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CartItem } from "./cart.entity";
import { User } from "../users/user.entity";
import { Product } from "../products/product.entity";
import { Proposal } from "../proposals/proposal.entity";
import { MaterialList } from "../material-lists/material-list.entity";
import { CartService } from "./cart.service";
import { CartController } from "./cart.controller";
import { AuthModule } from "../auth/auth.module";
import { ProjectsModule } from "../projects/projects.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CartItem,
      User,
      Product,
      Proposal,
      MaterialList,
    ]),
    AuthModule,
    ProjectsModule,
  ],
  controllers: [CartController],
  providers: [CartService],
  exports: [CartService],
})
export class CartModule {}
