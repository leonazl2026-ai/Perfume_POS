/**
 * Plain, JSON-serializable shapes handed from the server component down to
 * the client POS terminal. Prisma `Decimal` never crosses this boundary —
 * everything is converted to `number` in lib/queries.ts.
 */

export interface CatalogDecantOption {
  id: string;
  sizeMl: number;
  price: number;
  /** (costPerMl * sizeMl) + vialCost — precomputed for the cart's profit preview. */
  unitCost: number;
}

export interface CatalogVariant {
  id: string;
  variantBatchId: string;
  productName: string;
  brand: string | null;
  fullBottleSizeMl: number;
  fullBottlePrice: number;
  bottleCost: number;
  costPerMl: number;
  vialCost: number;
  unopenedBottles: number;
  decantActiveRemainingMl: number;
  decantOptions: CatalogDecantOption[];
}

export interface CatalogBundleConstituent {
  productVariantId: string;
  variantBatchId: string;
  productName: string;
  itemType: "FULL_BOTTLE" | "DECANT";
  decantSizeMl: number | null;
  /** Units of this constituent per ONE bundle sold. */
  quantity: number;
  unitCost: number;
}

export interface CatalogBundle {
  id: string;
  name: string;
  sku: string;
  description: string | null;
  price: number;
  /** Sum of (constituent unit cost * qty) at the time the page was rendered. */
  cost: number;
  constituents: CatalogBundleConstituent[];
}

export interface PosCatalog {
  variants: CatalogVariant[];
  bundles: CatalogBundle[];
}
