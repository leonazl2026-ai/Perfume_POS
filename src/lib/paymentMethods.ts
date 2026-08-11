/**
 * Payment methods accepted by the shop.
 *
 * Stored on Sale as a plain string (not an enum) so historical sales keep the
 * label they were rung up under even if this list changes later.
 */

export const PAYMENT_METHODS = [
  "CASH",
  "KPAY",
  "CBPAY",
  "AYAPAY",
  "WAVE",
  "KBZ_MOBILE_BANKING",
  "CB_MOBILE_BANKING",
  "AYA_MOBILE_BANKING",
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_LABELS: Record<string, string> = {
  CASH: "Cash",
  KPAY: "Kpay",
  CBPAY: "CBpay",
  AYAPAY: "AYApay",
  WAVE: "Wave",
  KBZ_MOBILE_BANKING: "KBZ Mobile Banking",
  CB_MOBILE_BANKING: "CB Mobile Banking",
  AYA_MOBILE_BANKING: "AYA Mobile Banking",
};

/** Falls back to the raw value so legacy rows still render something sane. */
export const paymentLabel = (value: string): string => PAYMENT_LABELS[value] ?? value;

export const DEFAULT_PAYMENT_METHOD: PaymentMethod = "CASH";
