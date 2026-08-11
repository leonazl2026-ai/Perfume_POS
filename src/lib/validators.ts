import { z } from "zod";

// ─── POS checkout ────────────────────────────────────────────────────

const fullBottleLine = z.object({
  type: z.literal("FULL_BOTTLE"),
  productVariantId: z.string().min(1),
  quantity: z.number().int().positive(),
});

const decantLine = z.object({
  type: z.literal("DECANT"),
  productVariantId: z.string().min(1),
  decantSizeMl: z.number().positive(),
  quantity: z.number().int().positive(),
});

const bundleLine = z.object({
  type: z.literal("BUNDLE"),
  bundleId: z.string().min(1),
  quantity: z.number().int().positive(),
});

export const cartLineSchema = z.discriminatedUnion("type", [
  fullBottleLine,
  decantLine,
  bundleLine,
]);

export const createSaleSchema = z.object({
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  paymentMethod: z.string().default("CASH"),
  discount: z.number().nonnegative().default(0),
  tax: z.number().nonnegative().default(0),
  notes: z.string().optional(),
  // Fulfilment captured at the till. Any of these present marks the sale
  // as a delivery order; see createSale for how the status is derived.
  orderChannel: z
    .enum(["FACEBOOK_MESSENGER", "TELEGRAM", "TIKTOK", "VIBER", "WALK_IN", "OTHER"])
    .default("WALK_IN"),
  isDelivery: z.boolean().optional(),
  deliveryAddress: z.string().optional(),
  courier: z.string().optional(),
  trackingNumber: z.string().optional(),
  lineItems: z.array(cartLineSchema).min(1, "Cart cannot be empty"),
});

// ─── Product variants ────────────────────────────────────────────────

export const decantOptionSchema = z.object({
  sizeMl: z.number().positive("Decant size must be greater than 0"),
  price: z.number().nonnegative("Decant price cannot be negative"),
});

export const variantFormSchema = z
  .object({
    id: z.string().optional(),
    productId: z.string().optional(),
    newProductName: z.string().optional(),
    newProductBrand: z.string().optional(),
    variantBatchId: z.string().min(1, "Variant Batch ID is required"),
    fullBottleSizeMl: z.number().positive("Bottle size must be greater than 0"),
    bottleCost: z.number().nonnegative("Bottle cost cannot be negative"),
    vialCost: z.number().nonnegative("Vial cost cannot be negative"),
    fullBottleSellingPrice: z.number().nonnegative("Selling price cannot be negative"),
    unopenedBottles: z.number().int().nonnegative("Sealed bottles must be a whole number"),
    decantActiveRemainingMl: z.number().nonnegative("Active ml cannot be negative"),
    notes: z.string().optional(),
    supplierId: z.string().optional().nullable(),
    decantOptions: z.array(decantOptionSchema),
  })
  .refine((d) => Boolean(d.productId) || Boolean(d.newProductName?.trim()), {
    message: "Choose an existing product or enter a new product name",
    path: ["newProductName"],
  })
  .refine(
    (d) => {
      const sizes = d.decantOptions.map((o) => o.sizeMl);
      return new Set(sizes).size === sizes.length;
    },
    { message: "Duplicate decant sizes are not allowed", path: ["decantOptions"] }
  )
  .refine((d) => d.decantOptions.every((o) => o.sizeMl <= d.fullBottleSizeMl), {
    message: "A decant cannot be larger than the bottle it is poured from",
    path: ["decantOptions"],
  });

export const supplierFormSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Supplier name is required"),
  phone: z.string().optional(),
  contactLink: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
  /** Set on the second submit, after the duplicate warning was shown. */
  confirmDuplicate: z.boolean().optional(),
});

export const stockInSchema = z.object({
  variantId: z.string().min(1),
  quantity: z.number().int().positive("Enter at least 1 bottle"),
  note: z.string().optional(),
});

export const openBottleSchema = z.object({
  variantId: z.string().min(1),
});

export const adjustMlSchema = z.object({
  variantId: z.string().min(1),
  newRemainingMl: z.number().nonnegative("Remaining ml cannot be negative"),
  reason: z.string().optional(),
});

export const setVariantActiveSchema = z.object({
  variantId: z.string().min(1),
  isActive: z.boolean(),
});

// ─── Bundles ─────────────────────────────────────────────────────────

export const bundleItemSchema = z
  .object({
    productVariantId: z.string().min(1),
    itemType: z.enum(["FULL_BOTTLE", "DECANT"]),
    decantSizeMl: z.number().positive().nullable().optional(),
    quantity: z.number().int().positive("Quantity must be at least 1"),
  })
  .refine((i) => i.itemType !== "DECANT" || (i.decantSizeMl ?? 0) > 0, {
    message: "Decant bundle items need a size in ml",
    path: ["decantSizeMl"],
  });

export const bundleFormSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Bundle name is required"),
  sku: z.string().min(1, "SKU is required"),
  description: z.string().optional(),
  sellingPrice: z.number().nonnegative("Selling price cannot be negative"),
  items: z.array(bundleItemSchema).min(1, "Add at least one item to the bundle"),
});

export const setBundleActiveSchema = z.object({
  bundleId: z.string().min(1),
  isActive: z.boolean(),
});

// ─── Expenses ────────────────────────────────────────────────────────

export const expenseFormSchema = z.object({
  id: z.string().optional(),
  categoryId: z.string().min(1, "Choose a category"),
  description: z.string().optional(),
  amount: z.number().positive("Amount must be greater than 0"),
  /** yyyy-mm-dd from <input type="date">. */
  expenseDate: z.string().min(1, "Choose a date"),
});

// ─── Fulfilment ──────────────────────────────────────────────────────

export const deliveryStatusEnum = z.enum([
  "NOT_REQUIRED",
  "PENDING",
  "PACKED",
  "SHIPPED",
  "DELIVERED",
  "RETURNED",
]);

export const updateDeliverySchema = z.object({
  saleId: z.string().min(1),
  deliveryStatus: deliveryStatusEnum,
  courier: z.string().optional(),
  trackingNumber: z.string().optional(),
  deliveryAddress: z.string().optional(),
});

export const bulkDeliverySchema = z.object({
  saleIds: z.array(z.string().min(1)).min(1, "Select at least one order"),
  deliveryStatus: deliveryStatusEnum,
  courier: z.string().optional(),
});

// ─── Wastage ─────────────────────────────────────────────────────────

export const wastageReasonEnum = z.enum([
  "SPILLAGE",
  "EVAPORATION",
  "DAMAGED",
  "TESTER",
]);

export const logWastageSchema = z
  .object({
    variantId: z.string().min(1),
    reason: wastageReasonEnum,
    mlDeducted: z.number().nonnegative().default(0),
    bottlesDeducted: z.number().int().nonnegative().default(0),
    note: z.string().optional(),
  })
  .refine((d) => d.mlDeducted > 0 || d.bottlesDeducted > 0, {
    message: "Enter an amount of ml or a number of bottles to write off",
    path: ["mlDeducted"],
  });

// ─── Customers ───────────────────────────────────────────────────────

export const orderChannelEnum = z.enum([
  "FACEBOOK_MESSENGER",
  "TELEGRAM",
  "TIKTOK",
  "VIBER",
  "WALK_IN",
  "OTHER",
]);

export const customerTierEnum = z.enum(["NEW", "REGULAR", "VIP"]);

export const customerFormSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  channel: orderChannelEnum.default("WALK_IN"),
  tier: customerTierEnum.optional(),
  tierLocked: z.boolean().optional(),
  preferences: z.string().optional(),
  notes: z.string().optional(),
});

// ─── Settings ────────────────────────────────────────────────────────

export const settingsFormSchema = z.object({
  lowStockBottles: z.number().int().nonnegative(),
  lowStockMl: z.number().nonnegative(),
  tierRegularSpend: z.number().nonnegative(),
  tierRegularOrders: z.number().int().nonnegative(),
  tierVipSpend: z.number().nonnegative(),
  tierVipOrders: z.number().int().nonnegative(),
  slowMovingDays: z.number().int().positive(),
});
