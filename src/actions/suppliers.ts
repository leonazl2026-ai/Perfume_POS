"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { UnauthorizedError } from "@/lib/errors";
import { requireAdmin } from "@/lib/session";
import { supplierFormSchema } from "@/lib/validators";
import { actionError, actionOk, type ActionResult } from "@/types/actions";
import type { DuplicateSupplierMatch, SupplierRow } from "@/types/admin";

export type SupplierFormInput = z.input<typeof supplierFormSchema>;

function revalidateSupplierViews() {
  revalidatePath("/admin/suppliers");
  revalidatePath("/admin/products");
}

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof UnauthorizedError) return error.message;
  if (error instanceof z.ZodError) return error.issues[0]?.message ?? fallback;
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
    return "That supplier no longer exists.";
  }
  console.error("[suppliers action]", error);
  return fallback;
}

/** Digits only, so "09-123 456" and "09123456" compare equal. */
const normalizePhone = (phone: string): string => phone.replace(/\D/g, "");

/**
 * Looks for suppliers that appear to be the same record.
 *
 * Matching is deliberately advisory rather than a hard constraint: two real
 * suppliers can share a shop name, and phone numbers are often missing or
 * entered in different formats. The UI shows this as a warning the admin
 * can confirm past.
 */
export async function findDuplicateSuppliers(
  name: string,
  phone: string,
  excludeId?: string
): Promise<DuplicateSupplierMatch[]> {
  const trimmedName = name.trim();
  const digits = normalizePhone(phone ?? "");

  if (!trimmedName && !digits) return [];

  // Phone comparison is done in JS because formatting varies; the candidate
  // set is small (suppliers are dozens, not thousands).
  const candidates = await prisma.supplier.findMany({
    where: excludeId ? { id: { not: excludeId } } : undefined,
    select: { id: true, name: true, phone: true },
  });

  const matches: DuplicateSupplierMatch[] = [];

  for (const candidate of candidates) {
    const nameMatch =
      trimmedName.length > 0 &&
      candidate.name.trim().toLowerCase() === trimmedName.toLowerCase();

    const phoneMatch =
      digits.length > 0 && candidate.phone
        ? normalizePhone(candidate.phone) === digits
        : false;

    if (nameMatch || phoneMatch) {
      matches.push({
        id: candidate.id,
        name: candidate.name,
        phone: candidate.phone,
        matchedOn: nameMatch && phoneMatch ? "BOTH" : nameMatch ? "NAME" : "PHONE",
      });
    }
  }

  return matches;
}

export async function upsertSupplier(
  rawInput: SupplierFormInput
): Promise<ActionResult<{ id: string; duplicates: DuplicateSupplierMatch[] }>> {
  try {
    await requireAdmin();
    const input = supplierFormSchema.parse(rawInput);

    const duplicates = await findDuplicateSuppliers(
      input.name,
      input.phone ?? "",
      input.id
    );

    // First submit reports duplicates and stops; the UI re-submits with
    // confirmDuplicate once the admin has seen the warning.
    if (duplicates.length > 0 && !input.confirmDuplicate) {
      const match = duplicates[0];
      const reason =
        match.matchedOn === "PHONE"
          ? "this phone number"
          : match.matchedOn === "NAME"
            ? "this name"
            : "this name and phone number";

      return actionError(`Supplier with ${reason} already exists: ${match.name}`);
    }

    const data = {
      name: input.name.trim(),
      phone: input.phone?.trim() || null,
      contactLink: input.contactLink?.trim() || null,
      address: input.address?.trim() || null,
      notes: input.notes?.trim() || null,
    };

    const supplier = input.id
      ? await prisma.supplier.update({ where: { id: input.id }, data })
      : await prisma.supplier.create({ data });

    revalidateSupplierViews();
    return actionOk({ id: supplier.id, duplicates });
  } catch (error) {
    return actionError(toErrorMessage(error, "Could not save the supplier."));
  }
}

export async function setSupplierActive(
  supplierId: string,
  isActive: boolean
): Promise<ActionResult<null>> {
  try {
    await requireAdmin();
    await prisma.supplier.update({ where: { id: supplierId }, data: { isActive } });
    revalidateSupplierViews();
    return actionOk(null);
  } catch (error) {
    return actionError(toErrorMessage(error, "Could not update the supplier."));
  }
}

/** Deletes only when no batch references the supplier; otherwise deactivates. */
export async function deleteSupplier(supplierId: string): Promise<ActionResult<null>> {
  try {
    await requireAdmin();

    const linked = await prisma.productVariant.count({ where: { supplierId } });
    if (linked > 0) {
      await prisma.supplier.update({ where: { id: supplierId }, data: { isActive: false } });
      revalidateSupplierViews();
      return actionError(
        `This supplier is linked to ${linked} batch${linked === 1 ? "" : "es"}, so it was deactivated instead of deleted.`
      );
    }

    await prisma.supplier.delete({ where: { id: supplierId } });
    revalidateSupplierViews();
    return actionOk(null);
  } catch (error) {
    return actionError(toErrorMessage(error, "Could not delete the supplier."));
  }
}

/** Used by the supplier picker in the batch form. */
export async function searchSuppliers(query: string): Promise<SupplierRow[]> {
  await requireAdmin();

  const search = query.trim();
  const rows = await prisma.supplier.findMany({
    where: {
      isActive: true,
      ...(search
        ? { OR: [{ name: { contains: search } }, { phone: { contains: search } }] }
        : {}),
    },
    include: { _count: { select: { variants: true } } },
    orderBy: { name: "asc" },
    take: 20,
  });

  return rows.map((s) => ({
    id: s.id,
    name: s.name,
    phone: s.phone,
    contactLink: s.contactLink,
    address: s.address,
    notes: s.notes,
    isActive: s.isActive,
    batchCount: s._count.variants,
  }));
}
