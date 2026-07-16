import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "./auth/auth.module";
import { User } from "./users/user.entity";
import { Project } from "./projects/project.entity";
import { ProjectDepartment } from "./projects/entities/project-department.entity";
import { ProjectProgressEntry } from "./projects/entities/project-progress-entry.entity";
import { ProjectNote } from "./projects/entities/project-note.entity";
import { ProjectProduct } from "./projects/entities/project-product.entity";
import { ProjectMember } from "./projects/entities/project-member.entity";
import { ProjectInvitation } from "./projects/entities/project-invitation.entity";
import { CommunityResidentProfile } from "./communities/entities/community-resident-profile.entity";
import { Proposal } from "./proposals/proposal.entity";
import { ProposalDepartment } from "./proposals/entities/proposal-department.entity";
import { ProposalSection } from "./proposals/entities/proposal-section.entity";
import { ProposalComment } from "./proposals/entities/proposal-comment.entity";
import { Product } from "./products/product.entity";
import { ProductFamily } from "./products/entities/product-family.entity";
import { ProductSubfamily } from "./products/entities/product-subfamily.entity";
import { MaterialList } from "./material-lists/material-list.entity";
import { ProfessionalDocument } from "./professional-documents/professional-document.entity";
import { PortfolioProject } from "./professional-documents/entities/portfolio-project.entity";
import { ProductTag } from "./professional-documents/entities/product-tag.entity";
import { Invoice } from "./invoices/entities/invoice.entity";
import { InvoiceLineItem } from "./invoices/entities/invoice-line-item.entity";
import { CommunityInvitation } from "./communities/entities/community-invitation.entity";
import { AdminInvitation } from "./admin/entities/admin-invitation.entity";
import { MarketSettings } from "./admin/entities/market-settings.entity";
import { CartItem } from "./cart/cart.entity";
import { Supplier } from "./suppliers/entities/supplier.entity";
import { FactoryCode } from "./suppliers/entities/factory-code.entity";
import { ClientOrder } from "./orders/entities/client-order.entity";
import { ClientOrderLineItem } from "./orders/entities/client-order-line-item.entity";
import { SupplierOrder } from "./supplier-orders/entities/supplier-order.entity";
import { SupplierOrderLineItem } from "./supplier-orders/entities/supplier-order-line-item.entity";
import { SupplierInvoice } from "./supplier-orders/entities/supplier-invoice.entity";
import { ProjectsModule } from "./projects/projects.module";
import { ProposalsModule } from "./proposals/proposals.module";
import { ProductsModule } from "./products/products.module";
import { MaterialListsModule } from "./material-lists/material-lists.module";
import { AdminModule } from "./admin/admin.module";
import { ProfessionalDocumentsModule } from "./professional-documents/professional-documents.module";
import { InvoicesModule } from "./invoices/invoices.module";
import { CommunitiesModule } from "./communities/communities.module";
import { EmailModule } from "./email/email.module";
import { CartModule } from "./cart/cart.module";
import { SuppliersModule } from "./suppliers/suppliers.module";
import { OrdersModule } from "./orders/orders.module";
import { SupplierOrdersModule } from "./supplier-orders/supplier-orders.module";
import { ReportsModule } from "./reports/reports.module";
import { ExportsModule } from "./exports/exports.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      useFactory: () => {
        const useSsl = process.env.DB_SSL === "true";
        return {
        type: "postgres" as const,
        host: process.env.DB_HOST ?? "localhost",
        port: +(process.env.DB_PORT ?? 5432),
        username: process.env.DB_USER ?? "postgres",
        password: process.env.DB_PASSWORD ?? "postgres",
        database: process.env.DB_NAME ?? "dekorama",
        ssl: useSsl ? { rejectUnauthorized: false } : undefined,
        autoLoadEntities: true,
        entities: [
          User,
          Project,
          ProjectDepartment,
          ProjectProgressEntry,
          ProjectNote,
          ProjectProduct,
          ProjectMember,
          ProjectInvitation,
          CommunityResidentProfile,
          Proposal,
          ProposalDepartment,
          ProposalSection,
          ProposalComment,
          Product,
          ProductFamily,
          ProductSubfamily,
          MaterialList,
          ProfessionalDocument,
          PortfolioProject,
          ProductTag,
          Invoice,
          InvoiceLineItem,
          CommunityInvitation,
          AdminInvitation,
          MarketSettings,
          CartItem,
          Supplier,
          FactoryCode,
          ClientOrder,
          ClientOrderLineItem,
          SupplierOrder,
          SupplierOrderLineItem,
          SupplierInvoice,
        ],
        synchronize: true,
      };
      },
    }),
    AuthModule,
    ProjectsModule,
    ProposalsModule,
    ProductsModule,
    MaterialListsModule,
    AdminModule,
    ProfessionalDocumentsModule,
    CommunitiesModule,
    EmailModule,
    InvoicesModule,
    CartModule,
    SuppliersModule,
    OrdersModule,
    SupplierOrdersModule,
    ReportsModule,
    ExportsModule,
  ],
})
export class AppModule {}
