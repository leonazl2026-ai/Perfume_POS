import type { Prisma, PrismaClient } from "@prisma/client";
import { calculateTier } from "@/lib/tiers";
import { getSettings, tierThresholds } from "@/lib/settings";
import type { OrderChannelValue } from "@/lib/channels";

type Db = PrismaClient | Prisma.TransactionClient;

/** Digits only, so 09-123 456 and 09123456 resolve to the same customer. */
export const normalizePhone = (phone: string | null | undefined): string =>
  (phone ?? "").replace(/\D/g, "");

export interface LinkCustomerInput {
  name?: string | null;
  phone?: string | null;
  address?: string | null;
  channel: OrderChannelValue;
}

/**
 * Finds or creates the CRM record for a sale.
 *
 * Phone is the identity key — it is the only field customers reliably repeat.
 * A sale with no phone gets no CRM record rather than creating an unmatchable
 * duplicate on every walk-in.
 */
export async function linkCustomerForSale(
  db: Db,
  input: LinkCustomerInput
): Promise<string | null> {
  const phone = normalizePhone(input.phone);
  if (!phone) return null;

  const existing = await db.customer.findUnique({ where: { phone } });

  if (existing) {
    // Fill gaps without clobbering details the admin curated in the CRM.
    await db.customer.update({
      where: { id: existing.id },
      data: {
        name: existing.name ?? input.name?.trim() ?? null,
        address: existing.address ?? input.address?.trim() ?? null,
      },
    });
    return existing.id;
  }

  const created = await db.customer.create({
    data: {
      phone,
      name: input.name?.trim() || null,
      address: input.address?.trim() || null,
      channel: input.channel,
    },
  });

  return created.id;
}

/**
 * Rebuilds a customer's aggregates from their completed sales and re-bands
 * their tier. Recomputed from source rather than incremented, so voiding a
 * sale corrects the totals automatically.
 */
export async function recalculateCustomer(db: Db, customerId: string): Promise<void> {
  const aggregate = await db.sale.aggregate({
    where: { customerId, status: "COMPLETED" },
    _sum: { total: true },
    _count: { _all: true },
    _max: { saleDate: true },
  });

  const totalSpent = Number(aggregate._sum.total ?? 0);
  const totalOrders = aggregate._count._all;

  const customer = await db.customer.findUnique({
    where: { id: customerId },
    select: { tierLocked: true },
  });
  if (!customer) return;

  // Read settings on the same client — this often runs inside a transaction.
  const settings = await getSettings(db);
  const tier = calculateTier(totalSpent, totalOrders, tierThresholds(settings));

  await db.customer.update({
    where: { id: customerId },
    data: {
      totalSpent,
      totalOrders,
      lastPurchaseAt: aggregate._max.saleDate ?? null,
      // A manually pinned tier is never overwritten by the calculation.
      ...(customer.tierLocked ? {} : { tier }),
    },
  });
}
