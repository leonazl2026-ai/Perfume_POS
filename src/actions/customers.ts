"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { UnauthorizedError } from "@/lib/errors";
import { currentUserCan, requirePermission } from "@/lib/session";
import { normalizePhone, recalculateCustomer } from "@/lib/customers";
import { getCustomerDetail, searchCustomerSuggestions } from "@/lib/crmQueries";
import { customerFormSchema } from "@/lib/validators";
import { actionError, actionOk, type ActionResult } from "@/types/actions";
import type { CustomerDetail, CustomerSuggestion } from "@/types/crm";

export type CustomerFormInput = z.input<typeof customerFormSchema>;

function revalidateCrmViews() {
  revalidatePath("/admin/customers");
  revalidatePath("/admin");
}

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof UnauthorizedError) return error.message;
  if (error instanceof z.ZodError) return error.issues[0]?.message ?? fallback;
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") return "A customer with that phone number already exists.";
    if (error.code === "P2025") return "That customer no longer exists.";
  }
  console.error("[customers action]", error);
  return fallback;
}

export async function upsertCustomer(
  rawInput: CustomerFormInput
): Promise<ActionResult<{ id: string }>> {
  try {
    await requirePermission("VIEW_CUSTOMERS");
    const input = customerFormSchema.parse(rawInput);

    const phone = normalizePhone(input.phone);

    const data = {
      name: input.name?.trim() || null,
      phone: phone || null,
      address: input.address?.trim() || null,
      channel: input.channel,
      preferences: input.preferences?.trim() || null,
      notes: input.notes?.trim() || null,
      tierLocked: input.tierLocked ?? false,
      // A tier is only written when the admin pinned it; otherwise the
      // recalculation below owns the value.
      ...(input.tierLocked && input.tier ? { tier: input.tier } : {}),
    };

    const customer = input.id
      ? await prisma.customer.update({ where: { id: input.id }, data })
      : await prisma.customer.create({ data });

    // Unlocking a tier hands control back to the automatic banding.
    if (!data.tierLocked) await recalculateCustomer(prisma, customer.id);

    revalidateCrmViews();
    return actionOk({ id: customer.id });
  } catch (error) {
    return actionError(toErrorMessage(error, "Could not save the customer."));
  }
}

export async function deleteCustomer(customerId: string): Promise<ActionResult<null>> {
  try {
    await requirePermission("VIEW_CUSTOMERS");

    const saleCount = await prisma.sale.count({ where: { customerId } });
    if (saleCount > 0) {
      return actionError(
        `This customer has ${saleCount} order${saleCount === 1 ? "" : "s"} and cannot be deleted.`
      );
    }

    await prisma.customer.delete({ where: { id: customerId } });
    revalidateCrmViews();
    return actionOk(null);
  } catch (error) {
    return actionError(toErrorMessage(error, "Could not delete the customer."));
  }
}

/** Loaded on demand by the CRM detail modal. */
export async function fetchCustomerDetail(customerId: string): Promise<CustomerDetail | null> {
  await requirePermission("VIEW_CUSTOMERS");
  return getCustomerDetail(customerId);
}

/**
 * POS type-ahead. Intentionally NOT admin-gated: cashiers work unauthenticated
 * and need to match repeat buyers. Returns only what the till must show.
 */
export async function lookupCustomers(query: string): Promise<CustomerSuggestion[]> {
  // Cashiers need this at the till, so POS_ACCESS is enough — but it is not
  // open to anonymous callers.
  if (!(await currentUserCan("POS_ACCESS")) && !(await currentUserCan("VIEW_CUSTOMERS"))) {
    return [];
  }
  return searchCustomerSuggestions(query);
}
