import { prisma } from "@/lib/prisma";
import type { OrderChannelValue } from "@/lib/channels";
import type { CustomerTierValue } from "@/lib/tiers";
import type {
  CrmSummary,
  CustomerDetail,
  CustomerPurchase,
  CustomerRow,
} from "@/types/crm";

function toRow(customer: {
  id: string;
  name: string | null;
  phone: string | null;
  address: string | null;
  channel: string;
  tier: string;
  tierLocked: boolean;
  preferences: string | null;
  notes: string | null;
  totalOrders: number;
  totalSpent: unknown;
  points: number;
  lastPurchaseAt: Date | null;
}): CustomerRow {
  return {
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    address: customer.address,
    channel: customer.channel as OrderChannelValue,
    tier: customer.tier as CustomerTierValue,
    tierLocked: customer.tierLocked,
    preferences: customer.preferences,
    notes: customer.notes,
    totalOrders: customer.totalOrders,
    totalSpent: Number(customer.totalSpent),
    points: customer.points,
    lastPurchaseAt: customer.lastPurchaseAt?.toISOString() ?? null,
  };
}

export interface CustomerFilters {
  query?: string;
  tier?: CustomerTierValue;
  channel?: OrderChannelValue;
}

export async function getCustomers(filters: CustomerFilters = {}): Promise<CustomerRow[]> {
  const search = filters.query?.trim();

  const rows = await prisma.customer.findMany({
    where: {
      ...(filters.tier ? { tier: filters.tier } : {}),
      ...(filters.channel ? { channel: filters.channel } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search } },
              { phone: { contains: search } },
              { address: { contains: search } },
            ],
          }
        : {}),
    },
    orderBy: [{ totalSpent: "desc" }, { createdAt: "desc" }],
    take: 500,
  });

  return rows.map(toRow);
}

export async function getCustomerDetail(customerId: string): Promise<CustomerDetail | null> {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: {
      sales: {
        include: {
          lineItems: {
            include: {
              productVariant: { include: { product: true } },
              bundle: true,
            },
          },
        },
        orderBy: { saleDate: "desc" },
        take: 100,
      },
    },
  });
  if (!customer) return null;

  const purchases: CustomerPurchase[] = customer.sales.map((sale) => ({
    saleId: sale.id,
    saleNumber: sale.saleNumber,
    saleDate: sale.saleDate.toISOString(),
    channel: sale.orderChannel as OrderChannelValue,
    paymentMethod: sale.paymentMethod,
    status: sale.status as "COMPLETED" | "VOIDED",
    total: Number(sale.total),
    profit: Number(sale.totalProfit),
    lines: sale.lineItems.map((line) => ({
      name:
        line.lineType === "BUNDLE"
          ? line.bundle?.name ?? "Bundle"
          : line.productVariant?.product.name ?? "Item",
      detail:
        line.lineType === "DECANT"
          ? `${line.decantSizeMl}ml decant`
          : line.lineType === "FULL_BOTTLE"
            ? "Full bottle"
            : "Bundle set",
      quantity: line.quantity,
      lineTotal: Number(line.lineTotal),
    })),
  }));

  // Which sizes this customer actually buys — the useful bit when a new
  // batch lands and you want to message the right people.
  const sizeTally = new Map<string, number>();
  for (const purchase of purchases) {
    if (purchase.status !== "COMPLETED") continue;
    for (const line of purchase.lines) {
      const key = line.detail;
      sizeTally.set(key, (sizeTally.get(key) ?? 0) + line.quantity);
    }
  }

  const favouriteSizes = [...sizeTally.entries()]
    .map(([label, quantity]) => ({ label, quantity }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 6);

  return { ...toRow(customer), purchases, favouriteSizes };
}

/** Type-ahead for the POS — matches on phone digits or name fragment. */
export async function searchCustomerSuggestions(query: string) {
  const search = query.trim();
  if (search.length < 2) return [];

  const digits = search.replace(/\D/g, "");

  const rows = await prisma.customer.findMany({
    where: {
      OR: [
        { name: { contains: search } },
        ...(digits.length >= 2 ? [{ phone: { contains: digits } }] : []),
      ],
    },
    orderBy: [{ lastPurchaseAt: "desc" }],
    take: 8,
  });

  return rows.map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    address: c.address,
    channel: c.channel as OrderChannelValue,
    tier: c.tier as CustomerTierValue,
    totalOrders: c.totalOrders,
    points: c.points,
  }));
}

export async function getCrmSummary(): Promise<CrmSummary> {
  const [total, tierGroups, channelGroups] = await Promise.all([
    prisma.customer.count(),
    prisma.customer.groupBy({ by: ["tier"], _count: { _all: true } }),
    prisma.customer.groupBy({ by: ["channel"], _count: { _all: true } }),
  ]);

  const byTier: Record<CustomerTierValue, number> = { NEW: 0, REGULAR: 0, VIP: 0 };
  for (const group of tierGroups) {
    byTier[group.tier as CustomerTierValue] = group._count._all;
  }

  const byChannel: Record<string, number> = {};
  for (const group of channelGroups) {
    byChannel[group.channel] = group._count._all;
  }

  return { total, byTier, byChannel };
}
