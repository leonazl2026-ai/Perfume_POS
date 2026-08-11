/** Discriminated union for a single line the cashier adds to the cart. */
export type CartLineInput =
  | { type: "FULL_BOTTLE"; productVariantId: string; quantity: number }
  | {
      type: "DECANT";
      productVariantId: string;
      decantSizeMl: number;
      quantity: number;
    }
  | { type: "BUNDLE"; bundleId: string; quantity: number };

export interface CreateSaleInput {
  customerName?: string;
  customerPhone?: string;
  paymentMethod?: string;
  discount?: number;
  tax?: number;
  notes?: string;
  /** Where the order originated — drives channel analytics. */
  orderChannel?: string;
  /** Loyalty points the customer wants to spend; clamped server-side. */
  redeemPoints?: number;
  /** Marks the sale for fulfilment; status starts at PENDING. */
  isDelivery?: boolean;
  deliveryAddress?: string;
  courier?: string;
  trackingNumber?: string;
  lineItems: CartLineInput[];
}

export interface CreateSaleResult {
  saleId: string;
  saleNumber: string;
  total: number;
  totalProfit: number;
  pointsEarned: number;
  pointsRedeemed: number;
  /** Balance after the sale; null when no CRM customer was attached. */
  pointsBalance: number | null;
}

/**
 * Next.js replaces thrown server-action errors with a generic message in
 * production builds, so the checkout action returns failures as data instead.
 */
export type CheckoutResult =
  | { ok: true; data: CreateSaleResult }
  | { ok: false; error: string };
