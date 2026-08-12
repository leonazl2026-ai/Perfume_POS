"use server";

import { revalidatePath } from "next/cache";
import {
  Prisma,
  DeliveryStatus,
  InventoryTxType,
  ReturnCondition,
  SaleStatus,
  WastageReason,
} from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { NotFoundError, UnauthorizedError } from "@/lib/errors";
import { requirePermission } from "@/lib/session";
import { recalculateCustomer } from "@/lib/customers";
import { recalculateLoyaltyPoints } from "@/lib/loyalty";
import { WASTAGE_CATEGORY_NAME } from "@/lib/settings";
import { handleReturnSchema } from "@/lib/validators";
import { actionError, actionOk, type ActionResult } from "@/types/actions";
import type { HandleReturnResult } from "@/types/reports";

const D = Prisma.Decimal;

async function getWastageCategoryId(tx: Prisma.TransactionClient): Promise<string> {
  const existing = await tx.expenseCategory.findUnique({
    where: { name: WASTAGE_CATEGORY_NAME },
  });
  if (existing) return existing.id;

  const created = await tx.expenseCategory.create({
    data: {
      name: WASTAGE_CATEGORY_NAME,
      description: "Spillage during decanting, Broken bottles, Damaged/lost in transit",
      sortOrder: 5,
    },
  });
  return created.id;
}

/**
 * Processes a returned delivery.
 *
 * Both conditions mark the sale RETURNED, which removes it from every
 * financial aggregate (they all filter `status: COMPLETED`) — that is what
 * takes it out of gross sales without special-casing each report.
 *
 * The two conditions then differ in where the goods went:
 *
 *   RETURNED_GOOD    — stock goes back to its original batches. Revenue and
 *                      COGS both disappear, so the net effect is zero.
 *   RETURNED_DAMAGED — stock stays gone. Revenue and COGS both disappear, so
 *                      without a write-off the loss would vanish from the
 *                      books entirely; a WastageLog plus its expense records
 *                      the cost of the goods against net profit.
 *
 * Restocking replays the sale's own InventoryTransaction rows and inverts
 * them, rather than re-deriving quantities from line items — that is exact
 * even for bundles, whose constituents are not visible on the sale line.
 */
export async function handleReturn(
  rawInput: unknown
): Promise<ActionResult<HandleReturnResult>> {
  try {
    await requirePermission("VIEW_SALES");
    const input = handleReturnSchema.parse(rawInput);

    const result = await prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findUnique({
        where: { id: input.saleId },
        include: { lineItems: true },
      });
      if (!sale) throw new NotFoundError("That sale no longer exists.");
      if (sale.status === SaleStatus.RETURNED) {
        throw new NotFoundError("That order has already been returned.");
      }
      if (sale.status === SaleStatus.VOIDED) {
        throw new NotFoundError("That sale is voided and cannot be returned.");
      }

      const condition = input.condition as ReturnCondition;
      const notes = input.notes?.trim() || null;

      // The stock movements this sale caused, excluding any prior reversal.
      const movements = await tx.inventoryTransaction.findMany({
        where: {
          saleId: sale.id,
          type: { in: [InventoryTxType.SALE_FULL_BOTTLE, InventoryTxType.SALE_DECANT, InventoryTxType.BUNDLE_SALE] },
        },
      });

      let lossValue = new D(0);
      let restockedVariants = 0;

      if (condition === ReturnCondition.RETURNED_GOOD) {
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
              saleId: sale.id,
              reference: `Returned in good condition — ${sale.saleNumber}`,
            },
          });

          restockedVariants += 1;
        }
      } else {
        // Damaged: nothing is restocked. Value what was lost at the batch's
        // current cost and book it, so net profit absorbs the goods.
        const categoryId = await getWastageCategoryId(tx);

        for (const movement of movements) {
          const variant = await tx.productVariant.findUnique({
            where: { id: movement.productVariantId },
            include: { product: true },
          });
          if (!variant) continue;

          const mlLost = -movement.mlDelta;
          const bottlesLost = -movement.bottlesDelta;
          if (mlLost <= 0 && bottlesLost <= 0) continue;

          const itemLoss = new D(variant.costPerMl)
            .mul(mlLost)
            .add(new D(variant.bottleCost).mul(bottlesLost));

          const description =
            `Delivery damage — ${variant.product.name} (${variant.variantBatchId}) ` +
            `on ${sale.saleNumber}` +
            (notes ? `: ${notes}` : "");

          let expenseId: string | null = null;
          if (itemLoss.greaterThan(0)) {
            const expense = await tx.expense.create({
              data: {
                categoryId,
                description,
                amount: itemLoss,
                expenseDate: new Date(),
                isAutomatic: true,
              },
            });
            expenseId = expense.id;
          }

          await tx.wastageLog.create({
            data: {
              productVariantId: variant.id,
              reason: WastageReason.DELIVERY_DAMAGE,
              mlDeducted: mlLost,
              bottlesDeducted: bottlesLost,
              costPerMl: variant.costPerMl,
              bottleCost: variant.bottleCost,
              lossValue: itemLoss,
              note: notes,
              expenseId,
            },
          });

          lossValue = lossValue.add(itemLoss);
        }
      }

      // Loyalty: claw back what was earned, hand back what was redeemed.
      if (sale.customerId) {
        const loyaltyMovements = await tx.loyaltyLog.findMany({
          where: { saleId: sale.id, type: { in: ["EARNED", "REDEEMED"] } },
        });

        if (loyaltyMovements.length > 0) {
          await tx.loyaltyLog.createMany({
            data: loyaltyMovements.map((movement) => ({
              customerId: movement.customerId,
              saleId: sale.id,
              type: "REVERTED" as const,
              points: -movement.points,
              description: `Return of ${sale.saleNumber} (${
                movement.type === "EARNED" ? "earned" : "redeemed"
              })`,
            })),
          });
        }

        await recalculateLoyaltyPoints(tx, sale.customerId);
      }

      await tx.sale.update({
        where: { id: sale.id },
        data: {
          status: SaleStatus.RETURNED,
          deliveryStatus: DeliveryStatus.RETURNED,
          returnCondition: condition,
          returnNotes: notes,
          returnedAt: new Date(),
        },
      });

      // Rebuilt from completed sales, so the return drops out of spend and
      // may re-band the customer's tier.
      if (sale.customerId) await recalculateCustomer(tx, sale.customerId);

      return {
        condition: input.condition,
        lossValue: lossValue.toNumber(),
        restockedVariants,
      };
    });

    revalidatePath("/admin/sales");
    revalidatePath("/admin/products");
    revalidatePath("/admin/wastage");
    revalidatePath("/admin/expenses");
    revalidatePath("/admin/customers");
    revalidatePath("/admin");
    revalidatePath("/pos");

    return actionOk(result);
  } catch (error) {
    if (error instanceof UnauthorizedError) return actionError(error.message);
    if (error instanceof NotFoundError) return actionError(error.message);
    if (error instanceof z.ZodError) {
      return actionError(error.issues[0]?.message ?? "Invalid return details");
    }
    console.error("[handleReturn]", error);
    return actionError("Could not process that return.");
  }
}
