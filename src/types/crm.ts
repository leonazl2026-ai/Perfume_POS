import type { OrderChannelValue } from "@/lib/channels";
import type { CustomerTierValue } from "@/lib/tiers";
import type { LoyaltyTypeValue } from "@/lib/loyalty";

export interface LoyaltyLogRow {
  id: string;
  type: LoyaltyTypeValue;
  /** Signed: positive added, negative removed. */
  points: number;
  description: string | null;
  saleNumber: string | null;
  createdAt: string; // ISO
}

export interface CustomerRow {
  id: string;
  name: string | null;
  phone: string | null;
  address: string | null;
  channel: OrderChannelValue;
  tier: CustomerTierValue;
  tierLocked: boolean;
  preferences: string | null;
  notes: string | null;
  totalOrders: number;
  totalSpent: number;
  points: number;
  lastPurchaseAt: string | null; // ISO
}

export interface CustomerPurchaseLine {
  name: string;
  detail: string;
  quantity: number;
  lineTotal: number;
}

export interface CustomerPurchase {
  saleId: string;
  saleNumber: string;
  saleDate: string; // ISO
  channel: OrderChannelValue;
  paymentMethod: string;
  status: "COMPLETED" | "VOIDED";
  total: number;
  profit: number;
  lines: CustomerPurchaseLine[];
}

export interface CustomerDetail extends CustomerRow {
  purchases: CustomerPurchase[];
  /** Decant sizes this customer has bought, most frequent first. */
  favouriteSizes: { label: string; quantity: number }[];
}

export interface CrmSummary {
  total: number;
  byTier: Record<CustomerTierValue, number>;
  byChannel: Record<string, number>;
}

/** Lightweight shape for the POS type-ahead. */
export interface CustomerSuggestion {
  id: string;
  name: string | null;
  phone: string | null;
  address: string | null;
  channel: OrderChannelValue;
  tier: CustomerTierValue;
  totalOrders: number;
  /** Current balance, so the till can offer redemption immediately. */
  points: number;
}
