import { Prisma } from "@prisma/client";

const D = Prisma.Decimal;
type Decimalish = Prisma.Decimal | number | string;

/**
 * Cost Per ML = Bottle Cost / Full Bottle Size.
 * Recompute and persist this any time bottleCost or fullBottleSizeMl changes
 * on a ProductVariant (see actions/products.ts).
 */
export function calcCostPerMl(bottleCost: Decimalish, fullBottleSizeMl: number): Prisma.Decimal {
  if (fullBottleSizeMl <= 0) throw new Error("fullBottleSizeMl must be > 0");
  return new D(bottleCost).div(fullBottleSizeMl);
}

/**
 * Unit cost of a single decant = (Cost Per ML * decant size) + Vial Cost.
 */
export function calcDecantUnitCost(
  costPerMl: Decimalish,
  decantSizeMl: number,
  vialCost: Decimalish
): Prisma.Decimal {
  return new D(costPerMl).mul(decantSizeMl).add(vialCost);
}

/**
 * Unit cost of a full bottle sale is simply the batch's bottle cost
 * (equivalent to costPerMl * fullBottleSizeMl, kept as its own accessor
 * for clarity at call sites).
 */
export function calcFullBottleUnitCost(bottleCost: Decimalish): Prisma.Decimal {
  return new D(bottleCost);
}

export interface CostedBundleConstituent {
  unitCost: Decimalish;
  quantity: number;
}

/**
 * Total Bundle Cost = Sum of (Item Unit Cost * Qty) across all constituents.
 * Always computed live from current variant costs at sale time so bundle
 * profit reflects today's costing, not stale numbers from bundle creation.
 */
export function calcBundleCost(items: CostedBundleConstituent[]): Prisma.Decimal {
  return items.reduce((sum, item) => sum.add(new D(item.unitCost).mul(item.quantity)), new D(0));
}

export function calcLineProfit(lineTotal: Decimalish, lineCost: Decimalish): Prisma.Decimal {
  return new D(lineTotal).sub(lineCost);
}
