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

export const DELIVERY_LABELS: Record<DeliveryStatusValue, string> = {
  NOT_REQUIRED: "Pickup",
  PENDING: "Pending",
  PACKED: "Packed",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  RETURNED: "Returned",
};

export const DELIVERY_STYLES: Record<DeliveryStatusValue, string> = {
  NOT_REQUIRED: "bg-gray-100 text-gray-600",
  PENDING: "bg-amber-100 text-amber-700",
  PACKED: "bg-blue-100 text-blue-700",
  SHIPPED: "bg-indigo-100 text-indigo-700",
  DELIVERED: "bg-emerald-100 text-emerald-700",
  RETURNED: "bg-red-100 text-red-700",
};
