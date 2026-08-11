"use server";

import { revalidatePath } from "next/cache";
import { Prisma, InventoryTxType } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { calcCostPerMl } from "@/lib/pricing";
import {
  adjustMlSchema,
  openBottleSchema,
  setVariantActiveSchema,
  stockInSchema,
  variantFormSchema,
} from "@/lib/validators";
import { UnauthorizedError } from "@/lib/errors";
import { requireAdmin } from "@/lib/session";
import { actionError, actionOk, type ActionResult } from "@/types/actions";

export type VariantFormInput = z.input<typeof variantFormSchema>;

function revalidateProductViews() {
  revalidatePath("/admin/products");
  revalidatePath("/admin/bundles");
  revalidatePath("/pos");
}

/** Turns expected failures into readable messages instead of leaking internals. */
function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof UnauthorizedError) return error.message;
  if (error instanceof z.ZodError) {
    return error.issues[0]?.message ?? fallback;
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      const target = (error.meta?.target as string[] | undefined)?.join(", ");
      return `That ${target ?? "value"} is already in use.`;
    }
    if (error.code === "P2025") return "That record no longer exists.";
  }
  console.error("[products action]", error);
  return fallback;
}

/**
 * Creates or updates a batch. On create, `unopenedBottles` and
 * `decantActiveRemainingMl` seed the opening inventory; on update they are
 * left alone — stock moves only through stockIn / openBottle / adjustDecantMl
 * so every change lands in the InventoryTransaction audit trail.
 */
export async function upsertProductVariant(
  rawInput: VariantFormInput
): Promise<ActionResult<{ id: string }>> {
  try {
    await requireAdmin();
    const input = variantFormSchema.parse(rawInput);
    const costPerMl = calcCostPerMl(input.bottleCost, input.fullBottleSizeMl);

    const id = await prisma.$transaction(async (tx) => {
      // Resolve the parent product — either an existing one or a new record.
      let productId = input.productId;
      if (!productId) {
        const created = await tx.product.create({
          data: {
            name: input.newProductName!.trim(),
            brand: input.newProductBrand?.trim() || null,
          },
        });
        productId = created.id;
      }

      const variant = input.id
        ? await tx.productVariant.update({
            where: { id: input.id },
            data: {
              productId,
              variantBatchId: input.variantBatchId.trim(),
              fullBottleSizeMl: input.fullBottleSizeMl,
              bottleCost: input.bottleCost,
              vialCost: input.vialCost,
              costPerMl,
              fullBottleSellingPrice: input.fullBottleSellingPrice,
              notes: input.notes?.trim() || null,
              supplierId: input.supplierId || null,
            },
          })
        : await tx.productVariant.create({
            data: {
              productId,
              variantBatchId: input.variantBatchId.trim(),
              fullBottleSizeMl: input.fullBottleSizeMl,
              bottleCost: input.bottleCost,
              vialCost: input.vialCost,
              costPerMl,
              fullBottleSellingPrice: input.fullBottleSellingPrice,
              unopenedBottles: input.unopenedBottles,
              decantActiveRemainingMl: input.decantActiveRemainingMl,
              purchaseDate: new Date(),
              notes: input.notes?.trim() || null,
              supplierId: input.supplierId || null,
            },
          });

      if (!input.id && (input.unopenedBottles > 0 || input.decantActiveRemainingMl > 0)) {
        await tx.inventoryTransaction.create({
          data: {
            productVariantId: variant.id,
            type: InventoryTxType.RESTOCK,
            bottlesDelta: input.unopenedBottles,
            mlDelta: input.decantActiveRemainingMl,
            reference: "Opening stock",
          },
        });
      }

      // Decant options are replaced wholesale. Safe to delete: sale lines and
      // bundle items store decantSizeMl directly, never a DecantOption FK.
      const keptSizes = input.decantOptions.map((o) => o.sizeMl);
      await tx.decantOption.deleteMany({
        where: { productVariantId: variant.id, sizeMl: { notIn: keptSizes } },
      });

      for (const option of input.decantOptions) {
        await tx.decantOption.upsert({
          where: {
            productVariantId_sizeMl: {
              productVariantId: variant.id,
              sizeMl: option.sizeMl,
            },
          },
          create: {
            productVariantId: variant.id,
            sizeMl: option.sizeMl,
            sellingPrice: option.price,
          },
          update: { sellingPrice: option.price, isActive: true },
        });
      }

      return variant.id;
    });

    revalidateProductViews();
    return actionOk({ id });
  } catch (error) {
    return actionError(toErrorMessage(error, "Could not save the product batch."));
  }
}

/** Receives new sealed bottles into a batch. */
export async function stockInBottles(
  rawInput: z.input<typeof stockInSchema>
): Promise<ActionResult<null>> {
  try {
    await requireAdmin();
    const input = stockInSchema.parse(rawInput);

    await prisma.$transaction(async (tx) => {
      await tx.productVariant.update({
        where: { id: input.variantId },
        data: { unopenedBottles: { increment: input.quantity } },
      });
      await tx.inventoryTransaction.create({
        data: {
          productVariantId: input.variantId,
          type: InventoryTxType.RESTOCK,
          bottlesDelta: input.quantity,
          reference: input.note?.trim() || "Stock in",
        },
      });
    });

    revalidateProductViews();
    return actionOk(null);
  } catch (error) {
    return actionError(toErrorMessage(error, "Could not add stock."));
  }
}

/**
 * Opens one sealed bottle for decanting: moves a unit out of the sealed pool
 * and its full volume into the active decant pool. This is the bridge between
 * the two inventory columns.
 */
export async function openBottleForDecanting(
  rawInput: z.input<typeof openBottleSchema>
): Promise<ActionResult<null>> {
  try {
    await requireAdmin();
    const input = openBottleSchema.parse(rawInput);

    await prisma.$transaction(async (tx) => {
      const variant = await tx.productVariant.findUnique({ where: { id: input.variantId } });
      if (!variant) throw new Error("Batch not found");

      // Guarded update — refuses to open a bottle the batch doesn't have.
      const opened = await tx.productVariant.updateMany({
        where: { id: input.variantId, unopenedBottles: { gte: 1 } },
        data: {
          unopenedBottles: { decrement: 1 },
          decantActiveRemainingMl: { increment: variant.fullBottleSizeMl },
        },
      });
      if (opened.count === 0) {
        throw new Error(`No sealed bottles left in batch "${variant.variantBatchId}"`);
      }

      await tx.inventoryTransaction.create({
        data: {
          productVariantId: input.variantId,
          type: InventoryTxType.ADJUSTMENT,
          bottlesDelta: -1,
          mlDelta: variant.fullBottleSizeMl,
          reference: "Opened bottle for decanting",
        },
      });
    });

    revalidateProductViews();
    return actionOk(null);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("No sealed bottles")) {
      return actionError(error.message);
    }
    return actionError(toErrorMessage(error, "Could not open a bottle."));
  }
}

/** Sets the active decant volume to an absolute figure (spillage, recount). */
export async function adjustDecantMl(
  rawInput: z.input<typeof adjustMlSchema>
): Promise<ActionResult<null>> {
  try {
    await requireAdmin();
    const input = adjustMlSchema.parse(rawInput);

    await prisma.$transaction(async (tx) => {
      const variant = await tx.productVariant.findUnique({ where: { id: input.variantId } });
      if (!variant) throw new Error("Batch not found");

      const delta = input.newRemainingMl - variant.decantActiveRemainingMl;

      await tx.productVariant.update({
        where: { id: input.variantId },
        data: { decantActiveRemainingMl: input.newRemainingMl },
      });
      await tx.inventoryTransaction.create({
        data: {
          productVariantId: input.variantId,
          type: InventoryTxType.ADJUSTMENT,
          mlDelta: delta,
          reference: input.reason?.trim() || "Manual ml adjustment",
        },
      });
    });

    revalidateProductViews();
    return actionOk(null);
  } catch (error) {
    return actionError(toErrorMessage(error, "Could not adjust the decant level."));
  }
}

export async function setVariantActive(
  rawInput: z.input<typeof setVariantActiveSchema>
): Promise<ActionResult<null>> {
  try {
    await requireAdmin();
    const input = setVariantActiveSchema.parse(rawInput);
    await prisma.productVariant.update({
      where: { id: input.variantId },
      data: { isActive: input.isActive },
    });
    revalidateProductViews();
    return actionOk(null);
  } catch (error) {
    return actionError(toErrorMessage(error, "Could not update the batch."));
  }
}
