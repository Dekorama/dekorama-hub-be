import { DataSource } from "typeorm";

type PreSyncDbConfig = {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  ssl?: boolean | { rejectUnauthorized: boolean };
};

/**
 * TypeORM synchronize may recreate NOT NULL numeric columns.
 * Backfill nulls first so ALTER/ADD does not fail on existing rows.
 */
export async function preSyncFixMaterialLists(
  config: PreSyncDbConfig,
): Promise<void> {
  const ds = new DataSource({
    type: "postgres",
    host: config.host,
    port: config.port,
    username: config.username,
    password: config.password,
    database: config.database,
    ssl: config.ssl,
    synchronize: false,
    entities: [],
  });

  await ds.initialize();
  try {
    const tables: Array<{ exists: boolean }> = await ds.query(`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'material_lists'
      ) AS exists
    `);
    if (!tables[0]?.exists) return;

    const columns: Array<{ column_name: string }> = await ds.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'material_lists'
        AND column_name IN ('quantity', 'suggestedPrice', 'orderedQuantity', 'discountPct')
    `);
    const names = new Set(columns.map((r) => r.column_name));

    if (names.has("quantity")) {
      await ds.query(
        `UPDATE material_lists SET quantity = 0 WHERE quantity IS NULL`,
      );
    }
    if (names.has("suggestedPrice")) {
      await ds.query(
        `UPDATE material_lists SET "suggestedPrice" = 0 WHERE "suggestedPrice" IS NULL`,
      );
    }
    if (names.has("orderedQuantity")) {
      await ds.query(
        `UPDATE material_lists SET "orderedQuantity" = 0 WHERE "orderedQuantity" IS NULL`,
      );
    }
    if (names.has("discountPct")) {
      await ds.query(
        `UPDATE material_lists SET "discountPct" = 0 WHERE "discountPct" IS NULL`,
      );
    }
  } finally {
    await ds.destroy();
  }
}
