/** Normalize product unit for document line snapshots (m² → m2). */
export function normalizeUnit(unit?: string | null): string {
  if (!unit?.trim()) return "unidad";
  const trimmed = unit.trim();
  const normalized = trimmed
    .toLowerCase()
    .replace("²", "2")
    .replace(/\s+/g, "");
  if (normalized === "m2") return "m2";
  return trimmed;
}

/** Clamp discount percentage to 0–100. */
export function clampDiscountPct(value?: number | null): number {
  if (value === undefined || value === null || Number.isNaN(Number(value))) {
    return 0;
  }
  const n = Number(value);
  if (n < 0) return 0;
  if (n > 100) return 100;
  return n;
}

/** Net line total after per-item discount. */
export function lineNetTotal(
  quantity: number,
  unitPrice: number,
  discountPct?: number | null,
): number {
  const discount = clampDiscountPct(discountPct);
  return Number(quantity) * Number(unitPrice) * (1 - discount / 100);
}

/** Display unit for PDFs (short UM). */
export function displayUnit(unit?: string | null): string {
  const u = normalizeUnit(unit);
  if (u === "m2") return "M2";
  if (u.toLowerCase() === "unidad" || u.toLowerCase() === "ud") return "UD";
  return u;
}

/** m² per box from product packaging; null if incomplete. */
export function m2PerBox(
  piecesPerBox?: number | null,
  unitPerPiece?: number | null,
): number | null {
  const pieces = Number(piecesPerBox);
  const perPiece = Number(unitPerPiece);
  if (!Number.isFinite(pieces) || !Number.isFinite(perPiece) || pieces <= 0 || perPiece <= 0) {
    return null;
  }
  return pieces * perPiece;
}

/** Box count for a given m² quantity (ceil). */
export function boxesForM2(quantityM2: number, m2PerBoxValue: number): number {
  if (m2PerBoxValue <= 0) return 0;
  return Math.ceil(Number(quantityM2) / m2PerBoxValue);
}
