import type { Prisma, PrismaClient } from "@prisma/client";
import type { LoyaltyConfig } from "@/lib/settings";

type Db = PrismaClient | Prisma.TransactionClient;

export type LoyaltyTypeValue = "EARNED" | "REDEEMED" | "MANUAL_ADJUSTMENT" | "REVERTED";

export const LOYALTY_TYPE_LABELS: Record<LoyaltyTypeValue, string> = {
  EARNED: "Earned",
  REDEEMED: "Redeemed",
  MANUAL_ADJUSTMENT: "Manual adjustment",
  REVERTED: "Reverted",
};

export const LOYALTY_TYPE_STYLES: Record<LoyaltyTypeValue, string> = {
  EARNED: "bg-emerald-100 text-emerald-700",
  REDEEMED: "bg-blue-100 text-blue-700",
  MANUAL_ADJUSTMENT: "bg-violet-100 text-violet-700",
  REVERTED: "bg-amber-100 text-amber-700",
};

/**
 * Points earned on an order.
 *
 * The base is the merchandise value actually paid for — subtotal less both
 * discounts, excluding tax — so a customer cannot earn points on tax, nor on
 * the part of the order funded by points they already had.
 *
 * Partial rate amounts do not earn: spending 1,900 Ks at 1,000 Ks/point
 * earns 1 point, not 1.9.
 */
export function calculatePointsEarned(
  eligibleAmount: number,
  config: LoyaltyConfig
): number {
  if (!config.enabled) return 0;
  if (config.earnRateAmount <= 0 || config.pointsEarnedPerRate <= 0) return 0;
  if (eligibleAmount <= 0) return 0;

  return Math.floor(eligibleAmount / config.earnRateAmount) * config.pointsEarnedPerRate;
}

/** Ks of discount granted by redeeming `points`. */
export function pointsToValue(points: number, config: LoyaltyConfig): number {
  if (!config.enabled || config.redeemPointValue <= 0) return 0;
  return Math.max(0, Math.floor(points)) * config.redeemPointValue;
}

export interface RedemptionResult {
  /** Points actually consumed after clamping. */
  points: number;
  /** Ks taken off the order. */
  discount: number;
}

/**
 * Clamps a redemption request to what is actually possible:
 * never more than the balance, and never more than the order is worth.
 *
 * Both caps matter — without the second, a large balance could push a total
 * below zero and hand out change.
 */
export function resolveRedemption(
  requestedPoints: number,
  availablePoints: number,
  redeemableAmount: number,
  config: LoyaltyConfig
): RedemptionResult {
  if (!config.enabled || config.redeemPointValue <= 0) return { points: 0, discount: 0 };

  const requested = Math.max(0, Math.floor(requestedPoints));
  if (requested === 0 || redeemableAmount <= 0) return { points: 0, discount: 0 };

  const affordableByBalance = Math.min(requested, Math.max(0, availablePoints));
  const affordableByOrder = Math.floor(redeemableAmount / config.redeemPointValue);

  const points = Math.min(affordableByBalance, affordableByOrder);
  return { points, discount: points * config.redeemPointValue };
}

/** Largest redemption the customer could apply to this order. */
export function maxRedeemablePoints(
  availablePoints: number,
  redeemableAmount: number,
  config: LoyaltyConfig
): number {
  return resolveRedemption(availablePoints, availablePoints, redeemableAmount, config).points;
}

/**
 * Rebuilds the cached balance from the ledger.
 *
 * Recomputed rather than incremented so that voids, reversals and manual
 * corrections can never leave the balance drifting from its history.
 */
export async function recalculateLoyaltyPoints(
  db: Db,
  customerId: string
): Promise<number> {
  const aggregate = await db.loyaltyLog.aggregate({
    where: { customerId },
    _sum: { points: true },
  });

  // Clamp at zero: a reversal can outrun an already-spent balance, and a
  // negative balance is not a thing the shop can act on.
  const balance = Math.max(0, aggregate._sum.points ?? 0);

  await db.customer.update({ where: { id: customerId }, data: { points: balance } });
  return balance;
}
