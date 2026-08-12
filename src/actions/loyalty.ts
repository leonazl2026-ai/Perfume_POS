"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { NotFoundError, UnauthorizedError } from "@/lib/errors";
import { requirePermission } from "@/lib/session";
import { recalculateLoyaltyPoints } from "@/lib/loyalty";
import { adjustPointsSchema } from "@/lib/validators";
import { actionError, actionOk, type ActionResult } from "@/types/actions";
import type { LoyaltyLogRow } from "@/types/crm";

/**
 * Manual correction by an admin — goodwill gestures, migrated balances,
 * fixing a mis-keyed sale. Written as a ledger row like any other movement,
 * so the balance stays reconstructible.
 */
export async function adjustCustomerPoints(
  rawInput: unknown
): Promise<ActionResult<{ balance: number }>> {
  try {
    await requirePermission("VIEW_CUSTOMERS");
    const input = adjustPointsSchema.parse(rawInput);

    const balance = await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findUnique({
        where: { id: input.customerId },
        select: { id: true, points: true },
      });
      if (!customer) throw new NotFoundError("That customer no longer exists.");

      // Refuse to deduct more than the customer holds — the balance is
      // clamped at zero anyway, so allowing it would silently lose points.
      if (input.points < 0 && Math.abs(input.points) > customer.points) {
        throw new NotFoundError(
          `Cannot deduct ${Math.abs(input.points)} points — the balance is only ${customer.points}.`
        );
      }

      await tx.loyaltyLog.create({
        data: {
          customerId: input.customerId,
          type: "MANUAL_ADJUSTMENT",
          points: input.points,
          description: input.note?.trim() || "Manual adjustment by admin",
        },
      });

      return recalculateLoyaltyPoints(tx, input.customerId);
    });

    revalidatePath("/admin/customers");
    return actionOk({ balance });
  } catch (error) {
    if (error instanceof UnauthorizedError) return actionError(error.message);
    if (error instanceof NotFoundError) return actionError(error.message);
    if (error instanceof z.ZodError) {
      return actionError(error.issues[0]?.message ?? "Invalid adjustment");
    }
    console.error("[adjustCustomerPoints]", error);
    return actionError("Could not adjust the points balance.");
  }
}

/** Points ledger for the CRM history modal. */
export async function fetchLoyaltyHistory(customerId: string): Promise<LoyaltyLogRow[]> {
  await requirePermission("VIEW_CUSTOMERS");

  const rows = await prisma.loyaltyLog.findMany({
    where: { customerId },
    include: { sale: { select: { saleNumber: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return rows.map((row) => ({
    id: row.id,
    type: row.type as LoyaltyLogRow["type"],
    points: row.points,
    description: row.description,
    saleNumber: row.sale?.saleNumber ?? null,
    createdAt: row.createdAt.toISOString(),
  }));
}
