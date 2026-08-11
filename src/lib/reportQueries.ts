import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toDateFilter, type DateRange } from "@/lib/dateRange";
import type {
  CustomerBreakdownRow,
  DeliveryStatusValue,
  ExpenseCategoryOption,
  ExpenseCategoryTotal,
  ExpenseRow,
  FinancialSummary,
  SaleDetail,
  SaleRow,
} from "@/types/reports";

/**
 * Reporting reads. Every figure here counts COMPLETED sales only — a voided
 * sale has had its stock returned and must not appear in revenue or profit.
 */

// ─── Expenses ────────────────────────────────────────────────────────

export async function getExpenseCategories(): Promise<ExpenseCategoryOption[]> {
  const rows = await prisma.expenseCategory.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });
  return rows.map((c) => ({ id: c.id, name: c.name, description: c.description }));
}

export interface ExpenseFilters {
  range: DateRange;
  categoryId?: string;
}

export async function getExpenses(filters: ExpenseFilters): Promise<ExpenseRow[]> {
  const rows = await prisma.expense.findMany({
    where: {
      expenseDate: toDateFilter(filters.range),
      ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
    },
    include: { category: true },
    orderBy: [{ expenseDate: "desc" }, { createdAt: "desc" }],
    take: 500,
  });

  return rows.map((e) => ({
    id: e.id,
    categoryId: e.categoryId,
    categoryName: e.category.name,
    description: e.description,
    amount: Number(e.amount),
    expenseDate: e.expenseDate.toISOString(),
  }));
}

/** Per-category totals for the period, including categories with no spend. */
export async function getExpenseTotalsByCategory(
  range: DateRange
): Promise<ExpenseCategoryTotal[]> {
  const [categories, grouped] = await Promise.all([
    prisma.expenseCategory.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.expense.groupBy({
      by: ["categoryId"],
      where: { expenseDate: toDateFilter(range) },
      _sum: { amount: true },
      _count: { _all: true },
    }),
  ]);

  const byId = new Map(grouped.map((g) => [g.categoryId, g]));

  return categories.map((category) => {
    const match = byId.get(category.id);
    return {
      categoryId: category.id,
      categoryName: category.name,
      total: Number(match?._sum.amount ?? 0),
      count: match?._count._all ?? 0,
    };
  });
}

async function sumExpenses(range: DateRange): Promise<number> {
  const result = await prisma.expense.aggregate({
    where: { expenseDate: toDateFilter(range) },
    _sum: { amount: true },
  });
  return Number(result._sum.amount ?? 0);
}

// ─── Sales ───────────────────────────────────────────────────────────

export interface SaleFilters {
  range: DateRange;
  deliveryStatus?: DeliveryStatusValue;
  includeVoided?: boolean;
  query?: string;
}

function buildSaleWhere(filters: SaleFilters): Prisma.SaleWhereInput {
  const search = filters.query?.trim();

  return {
    saleDate: toDateFilter(filters.range),
    ...(filters.includeVoided ? {} : { status: "COMPLETED" as const }),
    ...(filters.deliveryStatus ? { deliveryStatus: filters.deliveryStatus } : {}),
    ...(search
      ? {
          OR: [
            { saleNumber: { contains: search } },
            { customerName: { contains: search } },
            { trackingNumber: { contains: search } },
          ],
        }
      : {}),
  };
}

export async function getSales(filters: SaleFilters): Promise<SaleRow[]> {
  const rows = await prisma.sale.findMany({
    where: buildSaleWhere(filters),
    include: { lineItems: { select: { quantity: true } } },
    orderBy: { saleDate: "desc" },
    take: 300,
  });

  return rows.map((s) => ({
    id: s.id,
    saleNumber: s.saleNumber,
    saleDate: s.saleDate.toISOString(),
    customerName: s.customerName,
    paymentMethod: s.paymentMethod,
    status: s.status as "COMPLETED" | "VOIDED",
    deliveryStatus: s.deliveryStatus as DeliveryStatusValue,
    courier: s.courier,
    trackingNumber: s.trackingNumber,
    deliveryAddress: s.deliveryAddress,
    itemCount: s.lineItems.reduce((sum, l) => sum + l.quantity, 0),
    total: Number(s.total),
    totalCost: Number(s.totalCost),
    totalProfit: Number(s.totalProfit),
  }));
}

export async function getSaleDetail(saleId: string): Promise<SaleDetail | null> {
  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    include: {
      lineItems: {
        include: {
          productVariant: { include: { product: true } },
          bundle: true,
        },
      },
    },
  });
  if (!sale) return null;

  return {
    id: sale.id,
    saleNumber: sale.saleNumber,
    saleDate: sale.saleDate.toISOString(),
    customerName: sale.customerName,
    paymentMethod: sale.paymentMethod,
    status: sale.status as "COMPLETED" | "VOIDED",
    deliveryStatus: sale.deliveryStatus as DeliveryStatusValue,
    courier: sale.courier,
    trackingNumber: sale.trackingNumber,
    deliveryAddress: sale.deliveryAddress,
    notes: sale.notes,
    subtotal: Number(sale.subtotal),
    discount: Number(sale.discount),
    tax: Number(sale.tax),
    total: Number(sale.total),
    totalCost: Number(sale.totalCost),
    totalProfit: Number(sale.totalProfit),
    itemCount: sale.lineItems.reduce((sum, l) => sum + l.quantity, 0),
    lineItems: sale.lineItems.map((line) => ({
      id: line.id,
      lineType: line.lineType as "FULL_BOTTLE" | "DECANT" | "BUNDLE",
      name:
        line.lineType === "BUNDLE"
          ? line.bundle?.name ?? "Bundle"
          : line.productVariant?.product.name ?? "Item",
      detail:
        line.lineType === "BUNDLE"
          ? line.bundle?.sku ?? ""
          : line.lineType === "DECANT"
            ? `${line.decantSizeMl}ml decant · ${line.productVariant?.variantBatchId ?? ""}`
            : `Full bottle · ${line.productVariant?.variantBatchId ?? ""}`,
      quantity: line.quantity,
      unitPrice: Number(line.unitPrice),
      lineTotal: Number(line.lineTotal),
      lineProfit: Number(line.lineProfit),
    })),
  };
}

export interface SaleLineExportRow {
  saleNumber: string;
  saleDate: Date;
  customerName: string | null;
  status: string;
  lineType: string;
  itemName: string;
  batchId: string;
  decantSizeMl: number | null;
  quantity: number;
  unitCost: number;
  unitPrice: number;
  lineCost: number;
  lineTotal: number;
  lineProfit: number;
}

/** Flattened sale-line rows for the line-item CSV export. */
export async function getSaleLinesForExport(
  filters: SaleFilters
): Promise<SaleLineExportRow[]> {
  const sales = await prisma.sale.findMany({
    where: buildSaleWhere(filters),
    include: {
      lineItems: {
        include: {
          productVariant: { include: { product: true } },
          bundle: true,
        },
      },
    },
    orderBy: { saleDate: "desc" },
    take: 2000,
  });

  return sales.flatMap((sale) =>
    sale.lineItems.map((line) => ({
      saleNumber: sale.saleNumber,
      saleDate: sale.saleDate,
      customerName: sale.customerName,
      status: sale.status,
      lineType: line.lineType,
      itemName:
        line.lineType === "BUNDLE"
          ? line.bundle?.name ?? "Bundle"
          : line.productVariant?.product.name ?? "Item",
      batchId:
        line.lineType === "BUNDLE"
          ? line.bundle?.sku ?? ""
          : line.productVariant?.variantBatchId ?? "",
      decantSizeMl: line.decantSizeMl,
      quantity: line.quantity,
      unitCost: Number(line.unitCost),
      unitPrice: Number(line.unitPrice),
      lineCost: Number(line.lineCost),
      lineTotal: Number(line.lineTotal),
      lineProfit: Number(line.lineProfit),
    }))
  );
}

/**
 * Headline P&L for the period. Revenue/COGS come from sales, expenses from
 * the expense ledger; net profit is the difference.
 */
export async function getFinancialSummary(range: DateRange): Promise<FinancialSummary> {
  const [salesAgg, expenseTotal] = await Promise.all([
    prisma.sale.aggregate({
      where: { saleDate: toDateFilter(range), status: "COMPLETED" },
      _sum: { total: true, totalCost: true, totalProfit: true },
      _count: { _all: true },
    }),
    sumExpenses(range),
  ]);

  const revenue = Number(salesAgg._sum.total ?? 0);
  const cogs = Number(salesAgg._sum.totalCost ?? 0);
  const grossProfit = Number(salesAgg._sum.totalProfit ?? 0);
  const saleCount = salesAgg._count._all;

  return {
    revenue,
    cogs,
    grossProfit,
    expenses: expenseTotal,
    netProfit: grossProfit - expenseTotal,
    saleCount,
    averageOrderValue: saleCount > 0 ? revenue / saleCount : 0,
  };
}

export async function getCustomerBreakdown(range: DateRange): Promise<CustomerBreakdownRow[]> {
  const grouped = await prisma.sale.groupBy({
    by: ["customerName"],
    where: { saleDate: toDateFilter(range), status: "COMPLETED" },
    _sum: { total: true, totalProfit: true },
    _count: { _all: true },
  });

  return grouped
    .map((row) => ({
      customerName: row.customerName,
      orderCount: row._count._all,
      totalSpend: Number(row._sum.total ?? 0),
      totalProfit: Number(row._sum.totalProfit ?? 0),
    }))
    .sort((a, b) => b.totalSpend - a.totalSpend)
    .slice(0, 25);
}

/** Counts per fulfilment state, for the delivery tracking board. */
export async function getDeliveryCounts(
  range: DateRange
): Promise<Record<DeliveryStatusValue, number>> {
  const grouped = await prisma.sale.groupBy({
    by: ["deliveryStatus"],
    where: { saleDate: toDateFilter(range), status: "COMPLETED" },
    _count: { _all: true },
  });

  const counts: Record<DeliveryStatusValue, number> = {
    NOT_REQUIRED: 0,
    PENDING: 0,
    PACKED: 0,
    SHIPPED: 0,
    DELIVERED: 0,
    RETURNED: 0,
  };

  for (const row of grouped) {
    counts[row.deliveryStatus as DeliveryStatusValue] = row._count._all;
  }

  return counts;
}
