import type { CatalogBundle, CatalogVariant, PosCatalog } from "@/types/catalog";
import type { CartLineInput } from "@/types/pos";

/**
 * Pure cart math — no React, no Prisma. The server re-derives every number
 * in `createSale` from the database; everything here is preview only.
 */

export interface CartLineBase {
  /** Stable identity used for merging duplicate adds and as the React key. */
  key: string;
  label: string;
  sublabel: string;
  unitPrice: number;
  unitCost: number;
  quantity: number;
}

export type CartLine =
  | (CartLineBase & { type: "FULL_BOTTLE"; variantId: string })
  | (CartLineBase & { type: "DECANT"; variantId: string; decantSizeMl: number })
  | (CartLineBase & { type: "BUNDLE"; bundleId: string });

export interface StockUsage {
  bottles: number;
  ml: number;
}

/** Guards against float drift when comparing accumulated ml against stock. */
const ML_EPSILON = 1e-6;

export const roundMl = (value: number): number => Math.round(value * 1000) / 1000;

// ─── Line constructors ───────────────────────────────────────────────

export function fullBottleLine(variant: CatalogVariant): CartLine {
  return {
    key: `fb:${variant.id}`,
    type: "FULL_BOTTLE",
    variantId: variant.id,
    label: variant.productName,
    sublabel: `Full Bottle ${variant.fullBottleSizeMl}ml · ${variant.variantBatchId}`,
    unitPrice: variant.fullBottlePrice,
    unitCost: variant.bottleCost,
    quantity: 1,
  };
}

export function decantLine(variant: CatalogVariant, sizeMl: number): CartLine | null {
  const option = variant.decantOptions.find((o) => o.sizeMl === sizeMl);
  if (!option) return null;

  return {
    key: `dc:${variant.id}:${sizeMl}`,
    type: "DECANT",
    variantId: variant.id,
    decantSizeMl: sizeMl,
    label: variant.productName,
    sublabel: `${sizeMl}ml Decant · ${variant.variantBatchId}`,
    unitPrice: option.price,
    unitCost: option.unitCost,
    quantity: 1,
  };
}

export function bundleLine(bundle: CatalogBundle): CartLine {
  return {
    key: `bd:${bundle.id}`,
    type: "BUNDLE",
    bundleId: bundle.id,
    label: bundle.name,
    sublabel: `Bundle · ${bundle.constituents.length} item${
      bundle.constituents.length === 1 ? "" : "s"
    }`,
    unitPrice: bundle.price,
    unitCost: bundle.cost,
    quantity: 1,
  };
}

// ─── Stock accounting ────────────────────────────────────────────────

/**
 * Totals how much of each variant the current cart already claims, expanding
 * bundle lines into their constituents. Lets the UI grey out options that
 * would oversell before the server ever rejects them.
 */
export function computeStockUsage(cart: CartLine[], catalog: PosCatalog): Map<string, StockUsage> {
  const usage = new Map<string, StockUsage>();

  const bump = (variantId: string, bottles: number, ml: number) => {
    const current = usage.get(variantId) ?? { bottles: 0, ml: 0 };
    usage.set(variantId, { bottles: current.bottles + bottles, ml: current.ml + ml });
  };

  for (const line of cart) {
    if (line.type === "FULL_BOTTLE") {
      bump(line.variantId, line.quantity, 0);
    } else if (line.type === "DECANT") {
      bump(line.variantId, 0, line.decantSizeMl * line.quantity);
    } else {
      const bundle = catalog.bundles.find((b) => b.id === line.bundleId);
      if (!bundle) continue;

      for (const c of bundle.constituents) {
        if (c.itemType === "FULL_BOTTLE") {
          bump(c.productVariantId, c.quantity * line.quantity, 0);
        } else {
          bump(c.productVariantId, 0, (c.decantSizeMl ?? 0) * c.quantity * line.quantity);
        }
      }
    }
  }

  return usage;
}

export function remainingStock(
  variant: CatalogVariant,
  usage: Map<string, StockUsage>
): StockUsage {
  const used = usage.get(variant.id) ?? { bottles: 0, ml: 0 };
  return {
    bottles: variant.unopenedBottles - used.bottles,
    ml: roundMl(variant.decantActiveRemainingMl - used.ml),
  };
}

/** How many more of this bundle can still be built from remaining stock. */
export function bundleAddableCount(
  bundle: CatalogBundle,
  variantsById: Map<string, CatalogVariant>,
  usage: Map<string, StockUsage>
): number {
  // Aggregate first — two constituents may draw on the same variant.
  const needs = new Map<string, StockUsage>();
  for (const c of bundle.constituents) {
    const current = needs.get(c.productVariantId) ?? { bottles: 0, ml: 0 };
    if (c.itemType === "FULL_BOTTLE") {
      current.bottles += c.quantity;
    } else {
      current.ml += (c.decantSizeMl ?? 0) * c.quantity;
    }
    needs.set(c.productVariantId, current);
  }

  let max = Number.POSITIVE_INFINITY;
  for (const [variantId, need] of needs) {
    const variant = variantsById.get(variantId);
    if (!variant) return 0;

    const remaining = remainingStock(variant, usage);
    if (need.bottles > 0) {
      max = Math.min(max, Math.floor(remaining.bottles / need.bottles));
    }
    if (need.ml > 0) {
      max = Math.min(max, Math.floor((remaining.ml + ML_EPSILON) / need.ml));
    }
  }

  return Number.isFinite(max) ? Math.max(0, max) : 0;
}

/** Whether one more unit of an existing cart line can be added. */
export function canIncrement(
  line: CartLine,
  catalog: PosCatalog,
  variantsById: Map<string, CatalogVariant>,
  usage: Map<string, StockUsage>
): boolean {
  if (line.type === "BUNDLE") {
    const bundle = catalog.bundles.find((b) => b.id === line.bundleId);
    return bundle ? bundleAddableCount(bundle, variantsById, usage) >= 1 : false;
  }

  const variant = variantsById.get(line.variantId);
  if (!variant) return false;

  const remaining = remainingStock(variant, usage);
  return line.type === "FULL_BOTTLE"
    ? remaining.bottles >= 1
    : remaining.ml + ML_EPSILON >= line.decantSizeMl;
}

// ─── Totals ──────────────────────────────────────────────────────────

export interface CartTotals {
  subtotal: number;
  cost: number;
  /** Subtotal less the manual discount — the base redemption can eat into. */
  merchandiseValue: number;
  loyaltyDiscount: number;
  total: number;
  profit: number;
  itemCount: number;
}

export function computeTotals(
  cart: CartLine[],
  discount: number,
  tax: number,
  loyaltyDiscount = 0
): CartTotals {
  const subtotal = cart.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  const cost = cart.reduce((sum, l) => sum + l.unitCost * l.quantity, 0);
  const merchandiseValue = subtotal - discount;

  return {
    subtotal,
    cost,
    merchandiseValue,
    loyaltyDiscount,
    total: merchandiseValue - loyaltyDiscount + tax,
    // A redeemed point is a real giveaway of margin, so it reduces profit.
    profit: merchandiseValue - loyaltyDiscount - cost,
    itemCount: cart.reduce((sum, l) => sum + l.quantity, 0),
  };
}

/** Maps the UI cart onto the payload shape `createSale` validates. */
export function toSaleLineInputs(cart: CartLine[]): CartLineInput[] {
  return cart.map((line) => {
    if (line.type === "FULL_BOTTLE") {
      return { type: "FULL_BOTTLE", productVariantId: line.variantId, quantity: line.quantity };
    }
    if (line.type === "DECANT") {
      return {
        type: "DECANT",
        productVariantId: line.variantId,
        decantSizeMl: line.decantSizeMl,
        quantity: line.quantity,
      };
    }
    return { type: "BUNDLE", bundleId: line.bundleId, quantity: line.quantity };
  });
}
