import { Logger } from "@nestjs/common";
import { DataSource } from "typeorm";
import * as bcrypt from "bcryptjs";
import { User, UserRole } from "./users/user.entity";

/**
 * Creates or updates admin from ADMIN_EMAIL / ADMIN_PASSWORD on boot.
 * Needed on Render free (no Shell to run npm run seed).
 */
export async function ensureAdminFromEnv(dataSource: DataSource): Promise<void> {
  const logger = new Logger("BootstrapAdmin");
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME ?? "Admin Dekorama";

  if (!email || !password) {
    logger.warn("ADMIN_EMAIL / ADMIN_PASSWORD not set — skip admin bootstrap");
    return;
  }

  const userRepo = dataSource.getRepository(User);
  const existing = await userRepo.findOneBy({ email });
  const passwordHash = bcrypt.hashSync(password, 10);

  if (!existing) {
    await userRepo.save(
      userRepo.create({
        name,
        email,
        passwordHash,
        role: UserRole.ADMIN,
        isVerified: true,
      }),
    );
    logger.log(`Admin created: ${email}`);
    return;
  }

  existing.name = name;
  existing.passwordHash = passwordHash;
  existing.role = UserRole.ADMIN;
  existing.isVerified = true;
  await userRepo.save(existing);
  logger.log(`Admin updated: ${email}`);
}
