import { SaleLineType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { calcDecantUnitCost, calcFullBottleUnitCost } from "@/lib/pricing";
import type {
  CatalogBundle,
  CatalogBundleConstituent,
  CatalogVariant,
  PosCatalog,
} from "@/types/catalog";
import type {
  AdminBundle,
  AdminProductOption,
  AdminVariant,
  SupplierRow,
} from "@/types/admin";

/**
 * Loads everything the POS terminal needs in two queries, converting all
 * Prisma `Decimal` values to plain numbers so the payload can cross the
 * server -> client component boundary.
 */
export async function getPosCatalog(): Promise<PosCatalog> {
  const [variantRows, bundleRows] = await Promise.all([
    prisma.productVariant.findMany({
      where: { isActive: true },
      include: {
        product: true,
        decantOptions: { where: { isActive: true }, orderBy: { sizeMl: "asc" } },
      },
      orderBy: [{ product: { name: "asc" } }, { variantBatchId: "asc" }],
    }),
    prisma.bundle.findMany({
      where: { isActive: true },
      include: {
        items: { include: { productVariant: { include: { product: true } } } },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  const variants: CatalogVariant[] = variantRows.map((v) => ({
    id: v.id,
    variantBatchId: v.variantBatchId,
    productName: v.product.name,
    brand: v.product.brand,
    fullBottleSizeMl: v.fullBottleSizeMl,
    fullBottlePrice: Number(v.fullBottleSellingPrice),
    bottleCost: Number(v.bottleCost),
    costPerMl: Number(v.costPerMl),
    vialCost: Number(v.vialCost),
    unopenedBottles: v.unopenedBottles,
    decantActiveRemainingMl: v.decantActiveRemainingMl,
    decantOptions: v.decantOptions.map((o) => ({
      id: o.id,
      sizeMl: o.sizeMl,
      price: Number(o.sellingPrice),
      unitCost: calcDecantUnitCost(v.costPerMl, o.sizeMl, v.vialCost).toNumber(),
    })),
  }));

  const bundles: CatalogBundle[] = bundleRows.map((b) => {
    const constituents: CatalogBundleConstituent[] = b.items.map((item) => {
      const variant = item.productVariant;
      const unitCost =
        item.itemType === SaleLineType.FULL_BOTTLE
          ? calcFullBottleUnitCost(variant.bottleCost).toNumber()
          : calcDecantUnitCost(variant.costPerMl, item.decantSizeMl ?? 0, variant.vialCost).toNumber();

      return {
        productVariantId: variant.id,
        variantBatchId: variant.variantBatchId,
        productName: variant.product.name,
        itemType: item.itemType === SaleLineType.FULL_BOTTLE ? "FULL_BOTTLE" : "DECANT",
        decantSizeMl: item.decantSizeMl,
        quantity: item.quantity,
        unitCost,
      };
    });

    return {
      id: b.id,
      name: b.name,
      sku: b.sku,
      description: b.description,
      price: Number(b.sellingPrice),
      cost: constituents.reduce((sum, c) => sum + c.unitCost * c.quantity, 0),
      constituents,
    };
  });

  return { variants, bundles };
}

// ─── Admin ───────────────────────────────────────────────────────────

/** Every batch including deactivated ones, for the products screen. */
export async function getAdminVariants(): Promise<AdminVariant[]> {
  const rows = await prisma.productVariant.findMany({
    include: {
      product: true,
      supplier: true,
      decantOptions: { orderBy: { sizeMl: "asc" } },
    },
    orderBy: [{ isActive: "desc" }, { product: { name: "asc" } }],
  });

  return rows.map((v) => ({
    id: v.id,
    variantBatchId: v.variantBatchId,
    productId: v.productId,
    productName: v.product.name,
    brand: v.product.brand,
    fullBottleSizeMl: v.fullBottleSizeMl,
    bottleCost: Number(v.bottleCost),
    costPerMl: Number(v.costPerMl),
    vialCost: Number(v.vialCost),
    fullBottlePrice: Number(v.fullBottleSellingPrice),
    unopenedBottles: v.unopenedBottles,
    decantActiveRemainingMl: v.decantActiveRemainingMl,
    isActive: v.isActive,
    notes: v.notes,
    supplierId: v.supplierId,
    supplierName: v.supplier?.name ?? null,
    decantOptions: v.decantOptions.map((o) => ({
      id: o.id,
      sizeMl: o.sizeMl,
      price: Number(o.sellingPrice),
      unitCost: calcDecantUnitCost(v.costPerMl, o.sizeMl, v.vialCost).toNumber(),
      isActive: o.isActive,
    })),
  }));
}

export async function getProductOptions(): Promise<AdminProductOption[]> {
  const rows = await prisma.product.findMany({ orderBy: { name: "asc" } });
  return rows.map((p) => ({ id: p.id, name: p.name, brand: p.brand }));
}

export async function getSuppliers(includeInactive = false): Promise<SupplierRow[]> {
  const rows = await prisma.supplier.findMany({
    where: includeInactive ? undefined : { isActive: true },
    include: { _count: { select: { variants: true } } },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });

  return rows.map((s) => ({
    id: s.id,
    name: s.name,
    phone: s.phone,
    contactLink: s.contactLink,
    address: s.address,
    notes: s.notes,
    isActive: s.isActive,
    batchCount: s._count.variants,
  }));
}

/** Bundles with live constituent costs and a sold-count guard for deletion. */
export async function getAdminBundles(): Promise<AdminBundle[]> {
  const rows = await prisma.bundle.findMany({
    include: {
      items: { include: { productVariant: { include: { product: true } } } },
      _count: { select: { saleLineItems: true } },
    },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });

  return rows.map((b) => {
    const items = b.items.map((item) => {
      const variant = item.productVariant;
      const unitCost =
        item.itemType === SaleLineType.FULL_BOTTLE
          ? calcFullBottleUnitCost(variant.bottleCost).toNumber()
          : calcDecantUnitCost(variant.costPerMl, item.decantSizeMl ?? 0, variant.vialCost).toNumber();

      return {
        id: item.id,
        productVariantId: variant.id,
        variantBatchId: variant.variantBatchId,
        productName: variant.product.name,
        itemType:
          item.itemType === SaleLineType.FULL_BOTTLE
            ? ("FULL_BOTTLE" as const)
            : ("DECANT" as const),
        decantSizeMl: item.decantSizeMl,
        quantity: item.quantity,
        unitCost,
      };
    });

    return {
      id: b.id,
      name: b.name,
      sku: b.sku,
      description: b.description,
      price: Number(b.sellingPrice),
      cost: items.reduce((sum, i) => sum + i.unitCost * i.quantity, 0),
      isActive: b.isActive,
      soldCount: b._count.saleLineItems,
      items,
    };
  });
}
