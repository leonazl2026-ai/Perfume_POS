/** Serializable shapes for the admin screens (Decimal -> number). */

export interface SupplierRow {
  id: string;
  name: string;
  phone: string | null;
  contactLink: string | null;
  address: string | null;
  notes: string | null;
  isActive: boolean;
  batchCount: number;
}

export interface DuplicateSupplierMatch {
  id: string;
  name: string;
  phone: string | null;
  matchedOn: "NAME" | "PHONE" | "BOTH";
}

export interface AdminDecantOption {
  id: string;
  sizeMl: number;
  price: number;
  unitCost: number;
  isActive: boolean;
}

export interface AdminVariant {
  id: string;
  variantBatchId: string;
  productId: string;
  productName: string;
  brand: string | null;
  fullBottleSizeMl: number;
  bottleCost: number;
  costPerMl: number;
  vialCost: number;
  fullBottlePrice: number;
  unopenedBottles: number;
  decantActiveRemainingMl: number;
  isActive: boolean;
  notes: string | null;
  supplierId: string | null;
  supplierName: string | null;
  decantOptions: AdminDecantOption[];
}

export interface AdminProductOption {
  id: string;
  name: string;
  brand: string | null;
}

export interface AdminBundleItem {
  id: string;
  productVariantId: string;
  variantBatchId: string;
  productName: string;
  itemType: "FULL_BOTTLE" | "DECANT";
  decantSizeMl: number | null;
  quantity: number;
  unitCost: number;
}

export interface AdminBundle {
  id: string;
  name: string;
  sku: string;
  description: string | null;
  price: number;
  cost: number;
  isActive: boolean;
  /** Number of sale lines referencing this bundle — blocks hard delete. */
  soldCount: number;
  items: AdminBundleItem[];
}
