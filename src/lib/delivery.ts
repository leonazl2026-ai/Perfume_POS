import type { DeliveryStatusValue } from "@/types/reports";

/**
 * Plain constants — kept out of any "use client" module so server components
 * can import them without pulling in a client boundary.
 */

export const DELIVERY_ORDER: DeliveryStatusValue[] = [
  "NOT_REQUIRED",
  "PENDING",
  "PACKED",
  "SHIPPED",
  "DELIVERED",
  "RETURNED",
];

/**
 * NOT_REQUIRED is the terminal state for walk-in and counter sales — nothing
 * is owed to the customer, so it reads as "Completed" rather than as a
 * pending fulfilment step.
 */
export const DELIVERY_LABELS: Record<DeliveryStatusValue, string> = {
  NOT_REQUIRED: "Completed",
  PENDING: "Pending",
  PACKED: "Packed",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  RETURNED: "Returned",
};

export const DELIVERY_STYLES: Record<DeliveryStatusValue, string> = {
  NOT_REQUIRED: "bg-emerald-100 text-emerald-700",
  PENDING: "bg-amber-100 text-amber-700",
  PACKED: "bg-blue-100 text-blue-700",
  SHIPPED: "bg-indigo-100 text-indigo-700",
  DELIVERED: "bg-emerald-100 text-emerald-700",
  RETURNED: "bg-red-100 text-red-700",
};

/** True when the sale needs fulfilment work — drives the receipt slip. */
export const isFulfilmentOrder = (status: DeliveryStatusValue): boolean =>
  status !== "NOT_REQUIRED";
