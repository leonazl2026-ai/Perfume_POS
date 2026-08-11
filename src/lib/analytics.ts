import { prisma } from "@/lib/prisma";
import { toDateFilter, type DateRange } from "@/lib/dateRange";
import type { OrderChannelValue } from "@/lib/channels";

/**
 * Analytics reads. Everything counts COMPLETED sales only — a voided sale
 * had its stock returned and must not inflate any ranking.
 *
 * Line-level rollups are done in JS after one indexed fetch rather than with
 * groupBy, because the interesting keys (brand, decant size, product name)
 * live on joined rows and SQLite has no lateral joins.
 */

interface LineRow {
  lineType: string;
  decantSizeMl: number | null;
  quantity: number;
  lineTotal: number;
  lineProfit: number;
  lineCost: number;
  productId: string | null;
  productName: string | null;
  brand: string | null;
  variantId: string | null;
  bundleName: string | null;
  paymentMethod: string;
  orderChannel: string;
}

async function fetchLines(range: DateRange): Promise<LineRow[]> {
  const rows = await prisma.saleLineItem.findMany({
    where: {
      sale: { saleDate: toDateFilter(range), status: "COMPLETED" },
    },
    include: {
      sale: { select: { paymentMethod: true, orderChannel: true } },
      productVariant: { include: { product: true } },
      bundle: { select: { name: true } },
    },
    take: 20_000,
  });

  return rows.map((line) => ({
    lineType: line.lineType,
    decantSizeMl: line.decantSizeMl,
    quantity: line.quantity,
    lineTotal: Number(line.lineTotal),
    lineProfit: Number(line.lineProfit),
    lineCost: Number(line.lineCost),
    productId: line.productVariant?.productId ?? null,
    productName: line.productVariant?.product.name ?? null,
    brand: line.productVariant?.product.brand ?? null,
    variantId: line.productVariantId,
    bundleName: line.bundle?.name ?? null,
    paymentMethod: line.sale.paymentMethod,
    orderChannel: line.sale.orderChannel,
  }));
}

// ─── Channel performance ─────────────────────────────────────────────

export interface ChannelPerformanceRow {
  channel: OrderChannelValue;
  orderCount: number;
  revenue: number;
  profit: number;
  averageOrderValue: number;
}

export async function getChannelPerformance(
  range: DateRange
): Promise<ChannelPerformanceRow[]> {
  const grouped = await prisma.sale.groupBy({
    by: ["orderChannel"],
    where: { saleDate: toDateFilter(range), status: "COMPLETED" },
    _sum: { total: true, totalProfit: true },
    _count: { _all: true },
  });

  return grouped
    .map((row) => {
      const revenue = Number(row._sum.total ?? 0);
      const orderCount = row._count._all;
      return {
        channel: row.orderChannel as OrderChannelValue,
        orderCount,
        revenue,
        profit: Number(row._sum.totalProfit ?? 0),
        averageOrderValue: orderCount > 0 ? revenue / orderCount : 0,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);
}

// ─── Payment method breakdown ────────────────────────────────────────

export interface PaymentBreakdownRow {
  method: string;
  orderCount: number;
  revenue: number;
  share: number;
}

export async function getPaymentBreakdown(range: DateRange): Promise<PaymentBreakdownRow[]> {
  const grouped = await prisma.sale.groupBy({
    by: ["paymentMethod"],
    where: { saleDate: toDateFilter(range), status: "COMPLETED" },
    _sum: { total: true },
    _count: { _all: true },
  });

  const total = grouped.reduce((sum, row) => sum + Number(row._sum.total ?? 0), 0);

  return grouped
    .map((row) => {
      const revenue = Number(row._sum.total ?? 0);
      return {
        method: row.paymentMethod,
        orderCount: row._count._all,
        revenue,
        share: total > 0 ? (revenue / total) * 100 : 0,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);
}

/** Payment split within one channel — "how do Messenger buyers pay?" */
export async function getPaymentByChannel(
  range: DateRange
): Promise<{ channel: OrderChannelValue; methods: PaymentBreakdownRow[] }[]> {
  const grouped = await prisma.sale.groupBy({
    by: ["orderChannel", "paymentMethod"],
    where: { saleDate: toDateFilter(range), status: "COMPLETED" },
    _sum: { total: true },
    _count: { _all: true },
  });

  const byChannel = new Map<string, PaymentBreakdownRow[]>();
  const channelTotals = new Map<string, number>();

  for (const row of grouped) {
    const revenue = Number(row._sum.total ?? 0);
    channelTotals.set(row.orderChannel, (channelTotals.get(row.orderChannel) ?? 0) + revenue);

    const list = byChannel.get(row.orderChannel) ?? [];
    list.push({
      method: row.paymentMethod,
      orderCount: row._count._all,
      revenue,
      share: 0,
    });
    byChannel.set(row.orderChannel, list);
  }

  return [...byChannel.entries()]
    .map(([channel, methods]) => {
      const total = channelTotals.get(channel) ?? 0;
      return {
        channel: channel as OrderChannelValue,
        methods: methods
          .map((m) => ({ ...m, share: total > 0 ? (m.revenue / total) * 100 : 0 }))
          .sort((a, b) => b.revenue - a.revenue),
      };
    })
    .sort((a, b) => {
      const aTotal = channelTotals.get(a.channel) ?? 0;
      const bTotal = channelTotals.get(b.channel) ?? 0;
      return bTotal - aTotal;
    });
}

// ─── Best sellers & profitability ────────────────────────────────────

export interface ProductPerformanceRow {
  key: string;
  label: string;
  sublabel: string;
  quantity: number;
  revenue: number;
  profit: number;
  margin: number;
}

function rollup(
  lines: LineRow[],
  keyOf: (line: LineRow) => { key: string; label: string; sublabel: string } | null
): ProductPerformanceRow[] {
  const map = new Map<string, ProductPerformanceRow>();

  for (const line of lines) {
    const identity = keyOf(line);
    if (!identity) continue;

    const existing = map.get(identity.key) ?? {
      ...identity,
      quantity: 0,
      revenue: 0,
      profit: 0,
      margin: 0,
    };

    existing.quantity += line.quantity;
    existing.revenue += line.lineTotal;
    existing.profit += line.lineProfit;
    map.set(identity.key, existing);
  }

  return [...map.values()].map((row) => ({
    ...row,
    margin: row.revenue > 0 ? (row.profit / row.revenue) * 100 : 0,
  }));
}

export interface BestSellerReport {
  byProduct: ProductPerformanceRow[];
  byBrand: ProductPerformanceRow[];
  bySize: ProductPerformanceRow[];
  mostProfitable: ProductPerformanceRow[];
}

export async function getBestSellers(range: DateRange): Promise<BestSellerReport> {
  const lines = await fetchLines(range);

  const byProduct = rollup(lines, (line) => {
    // Bundles are rolled up under their own name — their constituents are
    // already counted through the bundle's cost, not as separate lines.
    if (line.lineType === "BUNDLE") {
      return line.bundleName
        ? { key: `bundle:${line.bundleName}`, label: line.bundleName, sublabel: "Bundle" }
        : null;
    }
    if (!line.productId || !line.productName) return null;
    return {
      key: `product:${line.productId}`,
      label: line.productName,
      sublabel: line.brand ?? "—",
    };
  }).sort((a, b) => b.quantity - a.quantity);

  const byBrand = rollup(lines, (line) => {
    if (line.lineType === "BUNDLE" || !line.brand) return null;
    return { key: `brand:${line.brand}`, label: line.brand, sublabel: "Brand" };
  }).sort((a, b) => b.revenue - a.revenue);

  const bySize = rollup(lines, (line) => {
    if (line.lineType === "BUNDLE") {
      return { key: "size:bundle", label: "Bundle sets", sublabel: "Sets" };
    }
    if (line.lineType === "FULL_BOTTLE") {
      return { key: "size:full", label: "Full bottles", sublabel: "Bottles" };
    }
    const size = line.decantSizeMl ?? 0;
    return { key: `size:${size}`, label: `${size}ml decant`, sublabel: "Decant" };
  }).sort((a, b) => b.quantity - a.quantity);

  const mostProfitable = [...byProduct].sort((a, b) => b.profit - a.profit);

  return { byProduct, byBrand, bySize, mostProfitable };
}

// ─── Slow-moving / dead stock ────────────────────────────────────────

export interface SlowMovingRow {
  variantId: string;
  variantBatchId: string;
  productName: string;
  brand: string | null;
  unopenedBottles: number;
  decantActiveRemainingMl: number;
  /** Value still sitting on the shelf, at cost. */
  stockValue: number;
  unitsSold: number;
  lastSoldAt: string | null;
  daysSinceLastSale: number | null;
}

/**
 * Batches with little or no movement in the window. Includes never-sold
 * batches, which is where dead stock usually hides.
 */
export async function getSlowMovingStock(
  days: number,
  maxUnits = 0
): Promise<SlowMovingRow[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const [variants, soldGroups, lastSales] = await Promise.all([
    prisma.productVariant.findMany({
      where: { isActive: true },
      include: { product: true },
    }),
    prisma.saleLineItem.groupBy({
      by: ["productVariantId"],
      where: { sale: { saleDate: { gte: since }, status: "COMPLETED" } },
      _sum: { quantity: true },
    }),
    prisma.saleLineItem.findMany({
      where: { sale: { status: "COMPLETED" } },
      select: { productVariantId: true, sale: { select: { saleDate: true } } },
      orderBy: { sale: { saleDate: "desc" } },
      take: 5000,
    }),
  ]);

  const soldByVariant = new Map(
    soldGroups.map((g) => [g.productVariantId, g._sum.quantity ?? 0])
  );

  // First occurrence wins — the list is already newest-first.
  const lastSoldByVariant = new Map<string, Date>();
  for (const row of lastSales) {
    if (row.productVariantId && !lastSoldByVariant.has(row.productVariantId)) {
      lastSoldByVariant.set(row.productVariantId, row.sale.saleDate);
    }
  }

  const now = Date.now();

  return variants
    .map((variant) => {
      const unitsSold = soldByVariant.get(variant.id) ?? 0;
      const lastSold = lastSoldByVariant.get(variant.id) ?? null;

      const stockValue =
        variant.unopenedBottles * Number(variant.bottleCost) +
        variant.decantActiveRemainingMl * Number(variant.costPerMl);

      return {
        variantId: variant.id,
        variantBatchId: variant.variantBatchId,
        productName: variant.product.name,
        brand: variant.product.brand,
        unopenedBottles: variant.unopenedBottles,
        decantActiveRemainingMl: variant.decantActiveRemainingMl,
        stockValue,
        unitsSold,
        lastSoldAt: lastSold?.toISOString() ?? null,
        daysSinceLastSale: lastSold
          ? Math.floor((now - lastSold.getTime()) / 86_400_000)
          : null,
      };
    })
    // Only flag batches that still hold stock — a sold-out batch is not dead.
    .filter(
      (row) =>
        row.unitsSold <= maxUnits &&
        (row.unopenedBottles > 0 || row.decantActiveRemainingMl > 0)
    )
    .sort((a, b) => b.stockValue - a.stockValue);
}
