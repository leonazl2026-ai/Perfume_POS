"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import {
  Prisma,
  SaleLineType,
  InventoryTxType,
  SaleStatus,
  DeliveryStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSaleSchema, updateDeliverySchema } from "@/lib/validators";
import { getSaleDetail } from "@/lib/reportQueries";
import { InsufficientStockError, NotFoundError, UnauthorizedError } from "@/lib/errors";
import { isAuthenticated, requireAdmin } from "@/lib/session";
import { actionError, actionOk, type ActionResult } from "@/types/actions";
import type { SaleDetail } from "@/types/reports";
import {
  calcBundleCost,
  calcDecantUnitCost,
  calcFullBottleUnitCost,
} from "@/lib/pricing";
import type { CheckoutResult, CreateSaleInput, CreateSaleResult } from "@/types/pos";

const D = Prisma.Decimal;

/** Row shape accumulated per cart line before it's persisted as a SaleLineItem. */
interface PendingLineItem {
  lineType: SaleLineType;
  productVariantId: string | null;
  decantSizeMl: number | null;
  bundleId: string | null;
  quantity: number;
  unitCost: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
  lineCost: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
  lineProfit: Prisma.Decimal;
}

/** Row shape for the inventory audit log, saleId attached after the Sale is created. */
interface PendingInventoryLog {
  productVariantId: string;
  type: InventoryTxType;
  bottlesDelta: number;
  mlDelta: number;
  reference?: string;
}

async function generateSaleNumber(tx: Prisma.TransactionClient): Promise<string> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const countToday = await tx.sale.count({ where: { saleDate: { gte: startOfDay } } });

  const now = new Date();
  const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(
    now.getDate()
  ).padStart(2, "0")}`;
  const seq = String(countToday + 1).padStart(4, "0");

  return `SALE-${datePart}-${seq}`;
}

/**
 * Core checkout logic. Runs entirely inside one Prisma interactive
 * transaction so a failure partway through (e.g. insufficient stock on the
 * 3rd cart line) rolls back every deduction already applied.
 *
 * Stock deductions use guarded `updateMany` calls (`WHERE stock >= needed`)
 * rather than read-then-write, so concurrent checkouts on the same batch
 * can't oversell it even without row-level locking.
 */
export async function createSale(rawInput: CreateSaleInput): Promise<CreateSaleResult> {
  const input = createSaleSchema.parse(rawInput);

  const result = await prisma.$transaction(async (tx) => {
    const lineItems: PendingLineItem[] = [];
    const inventoryLogs: PendingInventoryLog[] = [];

    for (const line of input.lineItems) {
      if (line.type === "FULL_BOTTLE") {
        const variant = await tx.productVariant.findUnique({
          where: { id: line.productVariantId },
        });
        if (!variant || !variant.isActive) {
          throw new NotFoundError(`Product variant ${line.productVariantId} not found`);
        }

        const deduct = await tx.productVariant.updateMany({
          where: { id: variant.id, unopenedBottles: { gte: line.quantity } },
          data: { unopenedBottles: { decrement: line.quantity } },
        });
        if (deduct.count === 0) {
          throw new InsufficientStockError(
            `Not enough unopened bottles for batch "${variant.variantBatchId}" ` +
              `(need ${line.quantity})`
          );
        }

        const unitCost = calcFullBottleUnitCost(variant.bottleCost);
        const unitPrice = new D(variant.fullBottleSellingPrice);
        const lineCost = unitCost.mul(line.quantity);
        const lineTotal = unitPrice.mul(line.quantity);

        lineItems.push({
          lineType: SaleLineType.FULL_BOTTLE,
          productVariantId: variant.id,
          decantSizeMl: null,
          bundleId: null,
          quantity: line.quantity,
          unitCost,
          unitPrice,
          lineCost,
          lineTotal,
          lineProfit: lineTotal.sub(lineCost),
        });

        inventoryLogs.push({
          productVariantId: variant.id,
          type: InventoryTxType.SALE_FULL_BOTTLE,
          bottlesDelta: -line.quantity,
          mlDelta: 0,
        });
      } else if (line.type === "DECANT") {
        const variant = await tx.productVariant.findUnique({
          where: { id: line.productVariantId },
        });
        if (!variant || !variant.isActive) {
          throw new NotFoundError(`Product variant ${line.productVariantId} not found`);
        }

        const decantOption = await tx.decantOption.findUnique({
          where: {
            productVariantId_sizeMl: {
              productVariantId: variant.id,
              sizeMl: line.decantSizeMl,
            },
          },
        });
        if (!decantOption || !decantOption.isActive) {
          throw new NotFoundError(
            `No ${line.decantSizeMl}ml decant option configured for batch "${variant.variantBatchId}"`
          );
        }

        const totalMl = line.decantSizeMl * line.quantity;
        const deduct = await tx.productVariant.updateMany({
          where: { id: variant.id, decantActiveRemainingMl: { gte: totalMl } },
          data: { decantActiveRemainingMl: { decrement: totalMl } },
        });
        if (deduct.count === 0) {
          throw new InsufficientStockError(
            `Not enough active decant volume for batch "${variant.variantBatchId}" ` +
              `(need ${totalMl}ml)`
          );
        }

        const unitCost = calcDecantUnitCost(variant.costPerMl, line.decantSizeMl, variant.vialCost);
        const unitPrice = new D(decantOption.sellingPrice);
        const lineCost = unitCost.mul(line.quantity);
        const lineTotal = unitPrice.mul(line.quantity);

        lineItems.push({
          lineType: SaleLineType.DECANT,
          productVariantId: variant.id,
          decantSizeMl: line.decantSizeMl,
          bundleId: null,
          quantity: line.quantity,
          unitCost,
          unitPrice,
          lineCost,
          lineTotal,
          lineProfit: lineTotal.sub(lineCost),
        });

        inventoryLogs.push({
          productVariantId: variant.id,
          type: InventoryTxType.SALE_DECANT,
          bottlesDelta: 0,
          mlDelta: -totalMl,
        });
      } else {
        // BUNDLE — deduct every constituent's real inventory, then price
        // the bundle line from the live sum of constituent costs.
        const bundle = await tx.bundle.findUnique({
          where: { id: line.bundleId },
          include: { items: { include: { productVariant: true } } },
        });
        if (!bundle || !bundle.isActive) {
          throw new NotFoundError(`Bundle ${line.bundleId} not found`);
        }
        if (bundle.items.length === 0) {
          throw new NotFoundError(`Bundle "${bundle.name}" has no constituent items configured`);
        }

        const constituentCosts: { unitCost: Prisma.Decimal; quantity: number }[] = [];

        for (const item of bundle.items) {
          const variant = item.productVariant;
          const totalNeeded = item.quantity * line.quantity; // per-bundle qty * bundles sold

          if (item.itemType === SaleLineType.FULL_BOTTLE) {
            const deduct = await tx.productVariant.updateMany({
              where: { id: variant.id, unopenedBottles: { gte: totalNeeded } },
              data: { unopenedBottles: { decrement: totalNeeded } },
            });
            if (deduct.count === 0) {
              throw new InsufficientStockError(
                `Bundle "${bundle.name}" needs ${totalNeeded} unopened bottle(s) of ` +
                  `batch "${variant.variantBatchId}" — not enough stock`
              );
            }

            constituentCosts.push({
              unitCost: calcFullBottleUnitCost(variant.bottleCost),
              quantity: totalNeeded,
            });

            inventoryLogs.push({
              productVariantId: variant.id,
              type: InventoryTxType.BUNDLE_SALE,
              bottlesDelta: -totalNeeded,
              mlDelta: 0,
              reference: `Bundle: ${bundle.name}`,
            });
          } else {
            // DECANT constituent
            if (!item.decantSizeMl) {
              throw new NotFoundError(
                `Bundle "${bundle.name}" has a decant constituent with no size configured`
              );
            }
            const mlNeeded = item.decantSizeMl * totalNeeded;

            const deduct = await tx.productVariant.updateMany({
              where: { id: variant.id, decantActiveRemainingMl: { gte: mlNeeded } },
              data: { decantActiveRemainingMl: { decrement: mlNeeded } },
            });
            if (deduct.count === 0) {
              throw new InsufficientStockError(
                `Bundle "${bundle.name}" needs ${mlNeeded}ml of batch ` +
                  `"${variant.variantBatchId}" — not enough active decant volume`
              );
            }

            constituentCosts.push({
              unitCost: calcDecantUnitCost(variant.costPerMl, item.decantSizeMl, variant.vialCost),
              quantity: totalNeeded,
            });

            inventoryLogs.push({
              productVariantId: variant.id,
              type: InventoryTxType.BUNDLE_SALE,
              bottlesDelta: 0,
              mlDelta: -mlNeeded,
              reference: `Bundle: ${bundle.name}`,
            });
          }
        }

        const bundleTotalCost = calcBundleCost(constituentCosts); // cost for `line.quantity` bundles
        const unitCost = bundleTotalCost.div(line.quantity); // cost per single bundle set
        const unitPrice = new D(bundle.sellingPrice);
        const lineTotal = unitPrice.mul(line.quantity);

        lineItems.push({
          lineType: SaleLineType.BUNDLE,
          productVariantId: null,
          decantSizeMl: null,
          bundleId: bundle.id,
          quantity: line.quantity,
          unitCost,
          unitPrice,
          lineCost: bundleTotalCost,
          lineTotal,
          lineProfit: lineTotal.sub(bundleTotalCost),
        });
      }
    }

    const subtotal = lineItems.reduce((sum, l) => sum.add(l.lineTotal), new D(0));
    const totalCost = lineItems.reduce((sum, l) => sum.add(l.lineCost), new D(0));
    const discount = new D(input.discount);
    const tax = new D(input.tax);
    const total = subtotal.sub(discount).add(tax);
    const totalProfit = subtotal.sub(discount).sub(totalCost);

    const saleNumber = await generateSaleNumber(tx);

    // A sale counts as a delivery order if the cashier ticked the box or
    // filled in any fulfilment field — so a typed address is never lost
    // just because the toggle was missed.
    const isDelivery = Boolean(
      input.isDelivery ||
        input.deliveryAddress?.trim() ||
        input.courier?.trim() ||
        input.trackingNumber?.trim()
    );

    const sale = await tx.sale.create({
      data: {
        saleNumber,
        customerName: input.customerName,
        customerPhone: input.customerPhone?.trim() || null,
        paymentMethod: input.paymentMethod,
        notes: input.notes,
        deliveryStatus: isDelivery ? DeliveryStatus.PENDING : DeliveryStatus.NOT_REQUIRED,
        deliveryAddress: input.deliveryAddress?.trim() || null,
        courier: input.courier?.trim() || null,
        trackingNumber: input.trackingNumber?.trim() || null,
        subtotal,
        discount,
        tax,
        total,
        totalCost,
        totalProfit,
        lineItems: {
          create: lineItems.map((l) => ({
            lineType: l.lineType,
            productVariantId: l.productVariantId,
            decantSizeMl: l.decantSizeMl,
            bundleId: l.bundleId,
            quantity: l.quantity,
            unitCost: l.unitCost,
            unitPrice: l.unitPrice,
            lineCost: l.lineCost,
            lineTotal: l.lineTotal,
            lineProfit: l.lineProfit,
          })),
        },
      },
    });

    if (inventoryLogs.length > 0) {
      await tx.inventoryTransaction.createMany({
        data: inventoryLogs.map((log) => ({ ...log, saleId: sale.id })),
      });
    }

    return {
      saleId: sale.id,
      saleNumber: sale.saleNumber,
      total: total.toNumber(),
      totalProfit: totalProfit.toNumber(),
    };
  });

  revalidatePath("/pos");
  revalidatePath("/admin/inventory");
  revalidatePath("/admin/sales");

  return result;
}

/**
 * Thin wrapper the POS terminal calls. Converts expected failures
 * (out of stock, missing product, invalid payload) into a result object the
 * client can render, and logs anything unexpected without leaking internals.
 */
export async function checkoutAction(input: CreateSaleInput): Promise<CheckoutResult> {
  try {
    const data = await createSale(input);
    return { ok: true, data };
  } catch (error) {
    if (error instanceof InsufficientStockError || error instanceof NotFoundError) {
      return { ok: false, error: error.message };
    }
    if (error instanceof ZodError) {
      return { ok: false, error: error.issues[0]?.message ?? "Invalid checkout data" };
    }

    console.error("[checkoutAction] unexpected failure", error);
    return { ok: false, error: "Checkout failed. Please try again." };
  }
}

// ─── Fulfilment & corrections ────────────────────────────────────────

/** Read-through for the sale detail dialog, which loads on demand. */
export async function fetchSaleDetail(saleId: string): Promise<SaleDetail | null> {
  if (!(await isAuthenticated())) return null;
  return getSaleDetail(saleId);
}

function revalidateSaleViews() {
  revalidatePath("/admin/sales");
  revalidatePath("/admin");
}

/** Updates courier tracking. Timestamps are stamped once, on first transition. */
export async function updateDelivery(
  rawInput: unknown
): Promise<ActionResult<null>> {
  try {
    await requireAdmin();
    const input = updateDeliverySchema.parse(rawInput);

    const sale = await prisma.sale.findUnique({ where: { id: input.saleId } });
    if (!sale) return actionError("That sale no longer exists.");

    const status = input.deliveryStatus as DeliveryStatus;

    await prisma.sale.update({
      where: { id: input.saleId },
      data: {
        deliveryStatus: status,
        courier: input.courier?.trim() || null,
        trackingNumber: input.trackingNumber?.trim() || null,
        deliveryAddress: input.deliveryAddress?.trim() || null,
        shippedAt:
          status === DeliveryStatus.SHIPPED && !sale.shippedAt ? new Date() : sale.shippedAt,
        deliveredAt:
          status === DeliveryStatus.DELIVERED && !sale.deliveredAt
            ? new Date()
            : sale.deliveredAt,
      },
    });

    revalidateSaleViews();
    return actionOk(null);
  } catch (error) {
    if (error instanceof UnauthorizedError) return actionError(error.message);
    if (error instanceof ZodError) {
      return actionError(error.issues[0]?.message ?? "Invalid delivery details");
    }
    console.error("[updateDelivery]", error);
    return actionError("Could not update the delivery details.");
  }
}

/**
 * Voids a completed sale and returns its stock.
 *
 * Rather than re-deriving what to restore from the line items (which would
 * have to re-expand bundles and could drift if a bundle's recipe changed),
 * this replays the sale's own InventoryTransaction rows and applies the
 * inverse of each delta — an exact reversal of what was actually deducted.
 */
export async function voidSale(saleId: string, reason?: string): Promise<ActionResult<null>> {
  try {
    await requireAdmin();

    await prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findUnique({ where: { id: saleId } });
      if (!sale) throw new NotFoundError("That sale no longer exists.");
      if (sale.status === SaleStatus.VOIDED) {
        throw new NotFoundError("That sale is already voided.");
      }

      const movements = await tx.inventoryTransaction.findMany({
        where: { saleId, type: { not: InventoryTxType.VOID_REVERSAL } },
      });

      for (const movement of movements) {
        await tx.productVariant.update({
          where: { id: movement.productVariantId },
          data: {
            unopenedBottles: { increment: -movement.bottlesDelta },
            decantActiveRemainingMl: { increment: -movement.mlDelta },
          },
        });

        await tx.inventoryTransaction.create({
          data: {
            productVariantId: movement.productVariantId,
            type: InventoryTxType.VOID_REVERSAL,
            bottlesDelta: -movement.bottlesDelta,
            mlDelta: -movement.mlDelta,
            saleId,
            reference: `Void of ${sale.saleNumber}`,
          },
        });
      }

      await tx.sale.update({
        where: { id: saleId },
        data: {
          status: SaleStatus.VOIDED,
          notes: reason?.trim()
            ? `${sale.notes ? `${sale.notes}\n` : ""}Voided: ${reason.trim()}`
            : sale.notes,
        },
      });
    });

    revalidateSaleViews();
    revalidatePath("/admin/products");
    revalidatePath("/pos");
    return actionOk(null);
  } catch (error) {
    if (error instanceof UnauthorizedError) return actionError(error.message);
    if (error instanceof NotFoundError) return actionError(error.message);
    console.error("[voidSale]", error);
    return actionError("Could not void the sale.");
  }
}
