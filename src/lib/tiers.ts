export type CustomerTierValue = "NEW" | "REGULAR" | "VIP";

export const CUSTOMER_TIERS: CustomerTierValue[] = ["NEW", "REGULAR", "VIP"];

export const TIER_LABELS: Record<CustomerTierValue, string> = {
  NEW: "New",
  REGULAR: "Regular",
  VIP: "VIP",
};

export const TIER_STYLES: Record<CustomerTierValue, string> = {
  NEW: "bg-gray-100 text-gray-600",
  REGULAR: "bg-blue-100 text-blue-700",
  VIP: "bg-amber-100 text-amber-800",
};

export interface TierThresholds {
  regularSpend: number;
  regularOrders: number;
  vipSpend: number;
  vipOrders: number;
}

/**
 * A customer reaches a tier by hitting EITHER the spend or the order-count
 * cutoff — a single big spender counts as much as a frequent small buyer.
 */
export function calculateTier(
  totalSpent: number,
  totalOrders: number,
  thresholds: TierThresholds
): CustomerTierValue {
  if (totalSpent >= thresholds.vipSpend || totalOrders >= thresholds.vipOrders) return "VIP";
  if (totalSpent >= thresholds.regularSpend || totalOrders >= thresholds.regularOrders) {
    return "REGULAR";
  }
  return "NEW";
}
