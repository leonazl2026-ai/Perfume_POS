"use server";

import { revalidatePath } from "next/cache";
import { Prisma, SaleLineType } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { bundleFormSchema, setBundleActiveSchema } from "@/lib/validators";
import { UnauthorizedError } from "@/lib/errors";
import { requireAdmin } from "@/lib/session";
import { actionError, actionOk, type ActionResult } from "@/types/actions";

export type BundleFormInput = z.input<typeof bundleFormSchema>;

function revalidateBundleViews() {
  revalidatePath("/admin/bundles");
  revalidatePath("/pos");
}

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof UnauthorizedError) return error.message;
  if (error instanceof z.ZodError) {
    return error.issues[0]?.message ?? fallback;
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") return "That SKU is already in use.";
    if (error.code === "P2025") return "That bundle no longer exists.";
    if (error.code === "P2003") return "One of the selected products no longer exists.";
  }
  console.error("[bundles action]", error);
  return fallback;
}

/**
 * Creates or updates a bundle and replaces its constituent list.
 * Bundle *cost* is deliberately not stored — it is recomputed from live
 * variant costs wherever it is displayed or sold, so a change in bottle
 * cost immediately flows through to bundle margin.
 */
export async function upsertBundle(
  rawInput: BundleFormInput
): Promise<ActionResult<{ id: string }>> {
  try {
    await requireAdmin();
    const input = bundleFormSchema.parse(rawInput);

    // Every referenced batch must exist before we rewrite the item list.
    const variantIds = [...new Set(input.items.map((i) => i.productVariantId))];
    const found = await prisma.productVariant.count({ where: { id: { in: variantIds } } });
    if (found !== variantIds.length) {
      return actionError("One or more selected batches no longer exist.");
    }

    const id = await prisma.$transaction(async (tx) => {
      const bundle = input.id
        ? await tx.bundle.update({
            where: { id: input.id },
            data: {
              name: input.name.trim(),
              sku: input.sku.trim(),
              description: input.description?.trim() || null,
              sellingPrice: input.sellingPrice,
            },
          })
        : await tx.bundle.create({
            data: {
              name: input.name.trim(),
              sku: input.sku.trim(),
              description: input.description?.trim() || null,
              sellingPrice: input.sellingPrice,
            },
          });

      // Replace constituents wholesale — simpler and safer than diffing, and
      // BundleItem is never referenced by historical sale lines.
      await tx.bundleItem.deleteMany({ where: { bundleId: bundle.id } });
      await tx.bundleItem.createMany({
        data: input.items.map((item) => ({
          bundleId: bundle.id,
          productVariantId: item.productVariantId,
          itemType:
            item.itemType === "FULL_BOTTLE" ? SaleLineType.FULL_BOTTLE : SaleLineType.DECANT,
          decantSizeMl: item.itemType === "DECANT" ? item.decantSizeMl ?? null : null,
          quantity: item.quantity,
        })),
      });

      return bundle.id;
    });

    revalidateBundleViews();
    return actionOk({ id });
  } catch (error) {
    return actionError(toErrorMessage(error, "Could not save the bundle."));
  }
}

export async function setBundleActive(
  rawInput: z.input<typeof setBundleActiveSchema>
): Promise<ActionResult<null>> {
  try {
    await requireAdmin();
    const input = setBundleActiveSchema.parse(rawInput);
    await prisma.bundle.update({
      where: { id: input.bundleId },
      data: { isActive: input.isActive },
    });
    revalidateBundleViews();
    return actionOk(null);
  } catch (error) {
    return actionError(toErrorMessage(error, "Could not update the bundle."));
  }
}

/**
 * Hard-deletes a bundle only if it has never been sold; otherwise the sale
 * history would lose the name it was sold under. Sold bundles are deactivated.
 */
export async function deleteBundle(bundleId: string): Promise<ActionResult<null>> {
  try {
    await requireAdmin();
    const soldCount = await prisma.saleLineItem.count({ where: { bundleId } });
    if (soldCount > 0) {
      await prisma.bundle.update({ where: { id: bundleId }, data: { isActive: false } });
      revalidateBundleViews();
      return actionError(
        "This bundle has sales history, so it was deactivated instead of deleted."
      );
    }

    await prisma.bundle.delete({ where: { id: bundleId } });
    revalidateBundleViews();
    return actionOk(null);
  } catch (error) {
    return actionError(toErrorMessage(error, "Could not delete the bundle."));
  }
}
