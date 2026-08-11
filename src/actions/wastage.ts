"use server";

import { revalidatePath } from "next/cache";
import { Prisma, InventoryTxType, WastageReason } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { InsufficientStockError, NotFoundError, UnauthorizedError } from "@/lib/errors";
import { requireAdmin } from "@/lib/session";
import { WASTAGE_CATEGORY_NAME } from "@/lib/settings";
import { wastageLabel } from "@/lib/wastage";
import { logWastageSchema } from "@/lib/validators";
import { actionError, actionOk, type ActionResult } from "@/types/actions";

const D = Prisma.Decimal;

/**
 * Ensures the wastage expense category exists.
 *
 * Write-offs are booked against the master sheet's existing "Loss & Damaged"
 * category (spillage, broken bottles, damage) rather than a parallel one, so
 * the P&L keeps a single line for stock loss.
 */
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
 * Writes stock off, values the loss, and mirrors it into the expense ledger.
 *
 *   Monetary loss = (ml x costPerMl) + (bottles x bottleCost)
 *
 * All three effects happen in one transaction, so stock can never drop
 * without the matching expense that keeps net profit honest.
 */
export async function logWastage(rawInput: unknown): Promise<ActionResult<{ loss: number }>> {
  try {
    await requireAdmin();
    const input = logWastageSchema.parse(rawInput);

    const loss = await prisma.$transaction(async (tx) => {
      const variant = await tx.productVariant.findUnique({
        where: { id: input.variantId },
        include: { product: true },
      });
      if (!variant) throw new NotFoundError("That batch no longer exists.");

      // Guarded deductions — a write-off cannot push stock negative.
      if (input.mlDeducted > 0) {
        const result = await tx.productVariant.updateMany({
          where: {
            id: variant.id,
            decantActiveRemainingMl: { gte: input.mlDeducted },
          },
          data: { decantActiveRemainingMl: { decrement: input.mlDeducted } },
        });
        if (result.count === 0) {
          throw new InsufficientStockError(
            `Only ${variant.decantActiveRemainingMl}ml active in batch "${variant.variantBatchId}"`
          );
        }
      }

      if (input.bottlesDeducted > 0) {
        const result = await tx.productVariant.updateMany({
          where: { id: variant.id, unopenedBottles: { gte: input.bottlesDeducted } },
          data: { unopenedBottles: { decrement: input.bottlesDeducted } },
        });
        if (result.count === 0) {
          throw new InsufficientStockError(
            `Only ${variant.unopenedBottles} sealed bottle(s) in batch "${variant.variantBatchId}"`
          );
        }
      }

      const mlLoss = new D(variant.costPerMl).mul(input.mlDeducted);
      const bottleLoss = new D(variant.bottleCost).mul(input.bottlesDeducted);
      const lossValue = mlLoss.add(bottleLoss);

      const reasonLabel = wastageLabel(input.reason);
      const description =
        `${reasonLabel} — ${variant.product.name} (${variant.variantBatchId}): ` +
        [
          input.mlDeducted > 0 ? `${input.mlDeducted}ml` : null,
          input.bottlesDeducted > 0 ? `${input.bottlesDeducted} bottle(s)` : null,
        ]
          .filter(Boolean)
          .join(" + ") +
        (input.note?.trim() ? ` — ${input.note.trim()}` : "");

      // Only book an expense when the loss has value; a zero-cost batch
      // would otherwise litter the ledger with 0 Ks rows.
      let expenseId: string | null = null;
      if (lossValue.greaterThan(0)) {
        const expense = await tx.expense.create({
          data: {
            categoryId: await getWastageCategoryId(tx),
            description,
            amount: lossValue,
            expenseDate: new Date(),
            isAutomatic: true,
          },
        });
        expenseId = expense.id;
      }

      await tx.wastageLog.create({
        data: {
          productVariantId: variant.id,
          reason: input.reason as WastageReason,
          mlDeducted: input.mlDeducted,
          bottlesDeducted: input.bottlesDeducted,
          costPerMl: variant.costPerMl,
          bottleCost: variant.bottleCost,
          lossValue,
          note: input.note?.trim() || null,
          expenseId,
        },
      });

      await tx.inventoryTransaction.create({
        data: {
          productVariantId: variant.id,
          type: InventoryTxType.WASTAGE,
          bottlesDelta: -input.bottlesDeducted,
          mlDelta: -input.mlDeducted,
          reference: description,
        },
      });

      return lossValue.toNumber();
    });

    revalidatePath("/admin/products");
    revalidatePath("/admin/expenses");
    revalidatePath("/admin/wastage");
    revalidatePath("/admin/sales");
    revalidatePath("/admin");
    revalidatePath("/pos");

    return actionOk({ loss });
  } catch (error) {
    if (error instanceof UnauthorizedError) return actionError(error.message);
    if (error instanceof InsufficientStockError) return actionError(error.message);
    if (error instanceof NotFoundError) return actionError(error.message);
    if (error instanceof z.ZodError) {
      return actionError(error.issues[0]?.message ?? "Invalid write-off");
    }
    console.error("[logWastage]", error);
    return actionError("Could not record the loss.");
  }
}

/**
 * Reverts a write-off: puts the stock back, removes the auto-generated
 * expense so net profit recovers, and marks the log voided.
 *
 * The log row is kept rather than deleted — a correction is itself a fact
 * worth auditing. All three effects share one transaction, so stock can
 * never be restored without the expense also being withdrawn.
 */
export async function voidWastage(wastageId: string): Promise<ActionResult<null>> {
  try {
    await requireAdmin();

    await prisma.$transaction(async (tx) => {
      const log = await tx.wastageLog.findUnique({ where: { id: wastageId } });
      if (!log) throw new NotFoundError("That wastage entry no longer exists.");
      if (log.voidedAt) throw new NotFoundError("That entry is already voided.");

      await tx.productVariant.update({
        where: { id: log.productVariantId },
        data: {
          decantActiveRemainingMl: { increment: log.mlDeducted },
          unopenedBottles: { increment: log.bottlesDeducted },
        },
      });

      // Detach before deleting: WastageLog.expenseId is a unique FK, so the
      // expense cannot be removed while the log still points at it.
      await tx.wastageLog.update({
        where: { id: wastageId },
        data: { voidedAt: new Date(), expenseId: null },
      });

      if (log.expenseId) {
        await tx.expense.delete({ where: { id: log.expenseId } });
      }

      await tx.inventoryTransaction.create({
        data: {
          productVariantId: log.productVariantId,
          type: InventoryTxType.VOID_REVERSAL,
          bottlesDelta: log.bottlesDeducted,
          mlDelta: log.mlDeducted,
          reference: `Reverted wastage (${wastageLabel(log.reason)})`,
        },
      });
    });

    revalidatePath("/admin/wastage");
    revalidatePath("/admin/products");
    revalidatePath("/admin/expenses");
    revalidatePath("/admin/sales");
    revalidatePath("/admin");
    revalidatePath("/pos");

    return actionOk(null);
  } catch (error) {
    if (error instanceof UnauthorizedError) return actionError(error.message);
    if (error instanceof NotFoundError) return actionError(error.message);
    console.error("[voidWastage]", error);
    return actionError("Could not void that entry.");
  }
}
