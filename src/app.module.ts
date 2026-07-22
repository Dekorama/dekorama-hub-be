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
import { SupplierFamily } from "./suppliers/entities/supplier-family.entity";
import { ClientOrder } from "./orders/entities/client-order.entity";
import { ClientOrderLineItem } from "./orders/entities/client-order-line-item.entity";
import { ClientOrderSection } from "./orders/entities/client-order-section.entity";
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
import { GcsModule } from "./gcs/gcs.module";
import { preSyncFixMaterialLists } from "./common/pre-sync-fix";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    GcsModule,
    TypeOrmModule.forRootAsync({
      useFactory: async () => {
        const isProd = process.env.NODE_ENV === "production";
        const useSsl = process.env.DB_SSL === "true";
        const host = process.env.DB_HOST;
        const username = process.env.DB_USER;
        const password = process.env.DB_PASSWORD;
        const database = process.env.DB_NAME;
        const port = +(process.env.DB_PORT ?? 5432);

        if (isProd && (!host || !username || !password || !database)) {
          throw new Error("DB_HOST, DB_USER, DB_PASSWORD, and DB_NAME are required in production");
        }

        const ssl = useSsl ? { rejectUnauthorized: false } : undefined;

        // Run before TypeORM synchronize so NOT NULL column rebuilds succeed.
        try {
          await preSyncFixMaterialLists({
            host: host ?? "localhost",
            port,
            username: username ?? "postgres",
            password: password ?? "postgres",
            database: database ?? "dekorama",
            ssl,
          });
        } catch (err) {
          // Table may not exist yet on first boot; synchronize will create it.
          // eslint-disable-next-line no-console
          console.warn("[pre-sync] material_lists fix skipped:", err);
        }

        return {
        type: "postgres" as const,
        host: host ?? "localhost",
        port,
        username: username ?? "postgres",
        password: password ?? "postgres",
        database: database ?? "dekorama",
        ssl,
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
          SupplierFamily,
          ClientOrder,
          ClientOrderLineItem,
          ClientOrderSection,
          SupplierOrder,
          SupplierOrderLineItem,
          SupplierInvoice,
        ],
        synchronize: process.env.DB_SYNCHRONIZE === "true" || !isProd,
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
