import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Supplier } from "./entities/supplier.entity";
import { FactoryCode } from "./entities/factory-code.entity";
import { SupplierFamily } from "./entities/supplier-family.entity";
import { Product } from "../products/product.entity";
import { ProductFamily } from "../products/entities/product-family.entity";
import { SuppliersService } from "./suppliers.service";
import { SuppliersController } from "./suppliers.controller";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Supplier,
      FactoryCode,
      SupplierFamily,
      Product,
      ProductFamily,
    ]),
    AuthModule,
  ],
  controllers: [SuppliersController],
  providers: [SuppliersService],
  exports: [SuppliersService],
})
export class SuppliersModule {}
