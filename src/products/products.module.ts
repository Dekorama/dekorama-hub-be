import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Product } from "./product.entity";
import { ProductFamily } from "./entities/product-family.entity";
import { ProductSubfamily } from "./entities/product-subfamily.entity";
import { ProductsService } from "./products.service";
import { ProductsController } from "./products.controller";
import { AuthModule } from "../auth/auth.module";
import { Supplier } from "../suppliers/entities/supplier.entity";
import { FactoryCode } from "../suppliers/entities/factory-code.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Product,
      ProductFamily,
      ProductSubfamily,
      Supplier,
      FactoryCode,
    ]),
    AuthModule,
  ],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
