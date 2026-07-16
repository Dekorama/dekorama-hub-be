import { ObjectLiteral, Repository } from "typeorm";

export async function generateSequentialNumber<T extends ObjectLiteral>(
  repo: Repository<T>,
  column: keyof T & string,
  prefix: string,
): Promise<string> {
  const year = new Date().getFullYear();
  const pattern = `${prefix}-${year}-%`;
  const alias = "entity";

  const row = await repo
    .createQueryBuilder(alias)
    .select(`${alias}.${String(column)}`, String(column))
    .where(`${alias}.${String(column)} LIKE :pattern`, { pattern })
    .orderBy(`${alias}.${String(column)}`, "DESC")
    .limit(1)
    .getRawOne<Record<string, string>>();

  let seq = 1;
  const lastValue = row?.[String(column)];
  if (lastValue) {
    const match = lastValue.match(/-(\d{5})$/);
    if (match) seq = parseInt(match[1], 10) + 1;
  }

  return `${prefix}-${year}-${String(seq).padStart(5, "0")}`;
}
