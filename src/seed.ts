/**
 * Seed script: creates a default admin user and product catalog structure for Dekorama.
 * Run: npx ts-node -r tsconfig-paths/register src/seed.ts
 * (or add "seed": "ts-node -r tsconfig-paths/register src/seed.ts" to package.json scripts)
 */
import "reflect-metadata";
import { DataSource } from "typeorm";
import { User, UserRole, AccountType } from "./users/user.entity";
import { ProductFamily } from "./products/entities/product-family.entity";
import { ProductSubfamily } from "./products/entities/product-subfamily.entity";
import { Project, ProjectType, ProjectStatus } from "./projects/project.entity";
import { ProjectDepartment, DepartmentType } from "./projects/entities/project-department.entity";
import { ProjectProgressEntry } from "./projects/entities/project-progress-entry.entity";
import { ProjectNote } from "./projects/entities/project-note.entity";
import { ProjectMember, ProjectMemberRole } from "./projects/entities/project-member.entity";
import { CommunityResidentProfile } from "./communities/entities/community-resident-profile.entity";
import * as bcrypt from "bcryptjs";
import { config as loadEnv } from "dotenv";
import { join } from "path";

loadEnv();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} env var is required`);
  }
  return value;
}

const useSsl = process.env.DB_SSL === "true";
const adminEmail = requireEnv("ADMIN_EMAIL");
const adminPassword = requireEnv("ADMIN_PASSWORD");
const adminName = process.env.ADMIN_NAME ?? "Admin Dekorama";

const ds = new DataSource({
  type: "postgres",
  host: process.env.DB_HOST ?? "localhost",
  port: +(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USER ?? "postgres",
  password: process.env.DB_PASSWORD ?? "postgres",
  database: process.env.DB_NAME ?? "dekorama",
  ssl: useSsl ? { rejectUnauthorized: false } : undefined,
  entities: [join(__dirname, "**", "*.entity{.ts,.js}")],
  synchronize: true,
});

async function seed() {
  await ds.initialize();
  
  // Seed admin user from env
  const userRepo = ds.getRepository(User);
  const existing = await userRepo.findOneBy({ email: adminEmail });
  const passwordHash = bcrypt.hashSync(adminPassword, 10);
  if (!existing) {
    const admin = userRepo.create({
      name: adminName,
      email: adminEmail,
      passwordHash,
      role: UserRole.ADMIN,
      isVerified: true,
    });
    await userRepo.save(admin);
    console.log("✅ Admin seeded:", admin.email);
  } else {
    existing.name = adminName;
    existing.passwordHash = passwordHash;
    existing.role = UserRole.ADMIN;
    existing.isVerified = true;
    await userRepo.save(existing);
    console.log("ℹ️  Admin updated:", existing.email);
  }

  // Seed product families
  const familyRepo = ds.getRepository(ProductFamily);
  const families = [
    { code: "REV", name: "Revestimientos", description: "Pinturas, vinílicos, cerámica, porcelanato", icon: "palette" },
    { code: "FON", name: "Fontanería", description: "Tuberías, grifería, sanitarios, accesorios de baño", icon: "plumbing" },
    { code: "ELE", name: "Electricidad", description: "Cableado, iluminación, tomacorrientes, breakers", icon: "electrical_services" },
    { code: "EST", name: "Estructuras", description: "Cemento, arena, cabillas, bloques", icon: "foundation" },
  ];

  for (const f of families) {
    const existingFamily = await familyRepo.findOneBy({ code: f.code });
    if (!existingFamily) {
      const family = familyRepo.create(f);
      await familyRepo.save(family);
      console.log(`✅ Family seeded: ${f.code} - ${f.name}`);
    } else {
      console.log(`ℹ️  Family already exists: ${f.code} - ${f.name}`);
    }
  }

  // Seed product subfamilies
  const subfamilyRepo = ds.getRepository(ProductSubfamily);
  const subfamilies = [
    // Revestimientos
    { code: "PIN", familyCode: "REV", name: "Pinturas", description: "Pinturas satinadas, mate, brillante" },
    { code: "VIN", familyCode: "REV", name: "Vinílicos", description: "Papel tapiz, vinilos decorativos" },
    { code: "CER", familyCode: "REV", name: "Cerámica", description: "Cerámica para pisos y paredes" },
    { code: "POR", familyCode: "REV", name: "Porcelanato", description: "Porcelanato de alta resistencia" },
    // Fontanería
    { code: "TUB", familyCode: "FON", name: "Tuberías", description: "Tuberías PVC, cobre, acero" },
    { code: "GRI", familyCode: "FON", name: "Grifería", description: "Grifos, llaves, mezcladoras" },
    { code: "SAN", familyCode: "FON", name: "Sanitarios", description: "Inodoros, lavamanos, duchas" },
    // Electricidad
    { code: "CAB", familyCode: "ELE", name: "Cableado", description: "Cables eléctricos, ductos" },
    { code: "ILU", familyCode: "ELE", name: "Iluminación", description: "Lámparas, bombillas, LED" },
    { code: "TOM", familyCode: "ELE", name: "Tomacorrientes", description: "Tomacorrientes, interruptores" },
    // Estructuras
    { code: "CEM", familyCode: "EST", name: "Cemento", description: "Cemento Portland, mortero" },
    { code: "ARE", familyCode: "EST", name: "Arena", description: "Arena lavada, de río" },
    { code: "CAB", familyCode: "EST", name: "Cabillas", description: "Cabillas de acero para construcción" },
    { code: "BLO", familyCode: "EST", name: "Bloques", description: "Bloques de concreto, arcilla" },
  ];

  for (const s of subfamilies) {
    const existingSubfamily = await subfamilyRepo.findOneBy({ code: s.code, familyCode: s.familyCode });
    if (!existingSubfamily) {
      const subfamily = subfamilyRepo.create(s);
      await subfamilyRepo.save(subfamily);
      console.log(`✅ Subfamily seeded: ${s.familyCode}-${s.code} - ${s.name}`);
    } else {
      console.log(`ℹ️  Subfamily already exists: ${s.familyCode}-${s.code} - ${s.name}`);
    }
  }

  // Demo users/projects — only when SEED_DEMO_USERS=true (never on prod by default)
  if (process.env.SEED_DEMO_USERS !== "true") {
    console.log("ℹ️  Skipping demo users (set SEED_DEMO_USERS=true to enable)");
    await ds.destroy();
    console.log("\n✨ Seed complete!\n");
    return;
  }

  const clientPassword = process.env.SEED_CLIENT_PASSWORD;
  const communityPassword = process.env.SEED_COMMUNITY_PASSWORD;
  const memberPassword = process.env.SEED_MEMBER_PASSWORD;
  if (!clientPassword || !communityPassword || !memberPassword) {
    throw new Error(
      "SEED_DEMO_USERS=true requires SEED_CLIENT_PASSWORD, SEED_COMMUNITY_PASSWORD, SEED_MEMBER_PASSWORD",
    );
  }

  // Seed example client user for projects
  const clientEmail = "cliente@ejemplo.com";
  let client = await userRepo.findOneBy({ email: clientEmail });
  if (!client) {
    client = userRepo.create({
      name: "Juan Pérez",
      email: clientEmail,
      passwordHash: bcrypt.hashSync(clientPassword, 10),
      role: UserRole.CLIENT,
      accountType: AccountType.INDIVIDUAL,
      isVerified: true,
    });
    await userRepo.save(client);
    console.log(`✅ Client seeded: ${client.email}`);
  } else {
    console.log(`ℹ️  Client already exists: ${client.email}`);
  }

  // Seed example projects with departments
  const projectRepo = ds.getRepository(Project);
  const deptRepo = ds.getRepository(ProjectDepartment);

  // Example 1: Reconstruction project
  const reconstructionTitle = "Reparación post-sismo Casa Familiar";
  let reconstructionProject = await projectRepo.findOneBy({ title: reconstructionTitle });
  if (!reconstructionProject) {
    reconstructionProject = projectRepo.create({
      title: reconstructionTitle,
      description: "Reparación de daños estructurales causados por sismo de magnitud 6.5",
      clientId: client.id,
      projectType: ProjectType.RECONSTRUCTION,
      locality: "Caracas, Venezuela",
      isPublic: true,
      isDetailed: true,
      status: ProjectStatus.OPEN,
      budget: 15000,
      location: "Urb. Los Palos Grandes, Caracas",
    });
    await projectRepo.save(reconstructionProject);

    const reconstructionDepts = [
      deptRepo.create({
        projectId: reconstructionProject.id,
        department: DepartmentType.STRUCTURE,
        technicalDetails: "Reparación de columnas y vigas con grietas superficiales",
        damageDescription: "Grietas diagonales en columnas C1, C2 y C3. Desprendimiento de recubrimiento en viga V1.",
        images: [],
        status: "planned" as any,
        progressPercentage: 0,
      }),
      deptRepo.create({
        projectId: reconstructionProject.id,
        department: DepartmentType.ELECTRICITY,
        technicalDetails: "Revisión del cableado en zonas afectadas",
        damageDescription: "Cables expuestos en sala principal. Tomacorriente T5 desprendido de pared.",
        images: [],
        status: "planned" as any,
        progressPercentage: 0,
      }),
    ];
    await deptRepo.save(reconstructionDepts);
    console.log(`✅ Reconstruction project seeded: ${reconstructionProject.title}`);
  } else {
    console.log(`ℹ️  Reconstruction project already exists: ${reconstructionProject.title}`);
  }

  // Example 2: Renovation project
  const renovationTitle = "Remodelación Apartamento Moderno";
  let renovationProject = await projectRepo.findOneBy({ title: renovationTitle });
  if (!renovationProject) {
    renovationProject = projectRepo.create({
      title: renovationTitle,
      description: "Actualización de diseño interior para estilo minimalista",
      clientId: client.id,
      projectType: ProjectType.RENOVATION,
      locality: "Valencia, Venezuela",
      isPublic: true,
      isDetailed: true,
      status: ProjectStatus.OPEN,
      budget: 8000,
      location: "Avenida Bolívar Norte, Valencia",
    });
    await projectRepo.save(renovationProject);

    const renovationDepts = [
      deptRepo.create({
        projectId: renovationProject.id,
        department: DepartmentType.FINISHES,
        technicalDetails: "Pintura color gris perla en todas las paredes. Piso laminado estilo madera",
        designNotes: "Estilo minimalista con tonos neutros. Acabados mate para reducir reflejos.",
        images: [],
        status: "planned" as any,
        progressPercentage: 0,
      }),
      deptRepo.create({
        projectId: renovationProject.id,
        department: DepartmentType.PLUMBING,
        technicalDetails: "Instalación de grifería moderna cromada",
        designNotes: "Griferías de tipo cascada para baño principal. Ducha tipo lluvia.",
        images: [],
        status: "planned" as any,
        progressPercentage: 0,
      }),
    ];
    await deptRepo.save(renovationDepts);
    console.log(`✅ Renovation project seeded: ${renovationProject.title}`);
  } else {
    console.log(`ℹ️  Renovation project already exists: ${renovationProject.title}`);
  }

  // Community organizer + member
  const communityEmail = "comunidad@ejemplo.com";
  let community = await userRepo.findOneBy({ email: communityEmail });
  if (!community) {
    community = userRepo.create({
      name: "Edificio Los Jardines",
      email: communityEmail,
      passwordHash: bcrypt.hashSync(communityPassword, 10),
      role: UserRole.CLIENT,
      accountType: AccountType.COMMUNITY,
      isVerified: true,
    });
    await userRepo.save(community);
    console.log(`✅ Community organizer seeded: ${community.email}`);
  }

  const memberEmail = "vecino@ejemplo.com";
  let member = await userRepo.findOneBy({ email: memberEmail });
  if (!community) community = await userRepo.findOneBy({ email: communityEmail });
  if (community && !member) {
    member = userRepo.create({
      name: "María Vecino",
      email: memberEmail,
      passwordHash: bcrypt.hashSync(memberPassword, 10),
      role: UserRole.CLIENT,
      accountType: AccountType.MEMBER,
      parentAccountId: community.id,
      isVerified: true,
    });
    await userRepo.save(member);

    const profileRepo = ds.getRepository(CommunityResidentProfile);
    await profileRepo.save(
      profileRepo.create({
        userId: member.id,
        unitNumber: "4B",
        floor: "4",
        isOccupant: true,
        notes: "Propietaria",
      }),
    );
    console.log(`✅ Community member seeded: ${member.email}`);
  }

  // Community project with progress + notes
  const communityProjectTitle = "Reparación fachada Edificio Los Jardines";
  let communityProject = await projectRepo.findOneBy({ title: communityProjectTitle });
  if (community && !communityProject) {
    communityProject = projectRepo.create({
      title: communityProjectTitle,
      description: "Reparación integral de fachada y áreas comunes del edificio",
      clientId: community.id,
      projectType: ProjectType.RECONSTRUCTION,
      locality: "Caracas",
      state: "Distrito Capital",
      postalCode: "1060",
      country: "VE",
      location: "Av. Francisco de Miranda, Torre Los Jardines",
      isPublic: false,
      isDetailed: true,
      status: ProjectStatus.IN_PROGRESS,
      budget: 45000,
    });
    await projectRepo.save(communityProject);

    const facadeDept = deptRepo.create({
      projectId: communityProject.id,
      department: DepartmentType.FINISHES,
      technicalDetails: "Repintado exterior con pintura impermeabilizante",
      damageDescription: "Grietas en muro norte, humedad en planta baja",
      status: "in_progress" as any,
      progressPercentage: 35,
    });
    await deptRepo.save(facadeDept);

    const memberRepo = ds.getRepository(ProjectMember);
    await memberRepo.save([
      memberRepo.create({
        projectId: communityProject.id,
        userId: community.id,
        role: ProjectMemberRole.OWNER,
      }),
    ]);

    const progressRepo = ds.getRepository(ProjectProgressEntry);
    await progressRepo.save(
      progressRepo.create({
        projectId: communityProject.id,
        departmentId: facadeDept.id,
        title: "Inicio de trabajos en fachada norte",
        description: "Andamios instalados, inicio de preparación de superficie",
        progressPercentage: 35,
        createdById: community.id,
      }),
    );

    const noteRepo = ds.getRepository(ProjectNote);
    await noteRepo.save(
      noteRepo.create({
        projectId: communityProject.id,
        authorId: community.id,
        content: "Junta de condominio aprobó presupuesto el 15/03. Obra iniciada.",
      }),
    );

    console.log(`✅ Community project seeded: ${communityProject.title}`);
  }

  console.log("\n✨ Seed complete!\n");
  await ds.destroy();
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
