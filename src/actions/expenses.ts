"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { expenseFormSchema } from "@/lib/validators";
import { UnauthorizedError } from "@/lib/errors";
import { requirePermission } from "@/lib/session";
import { actionError, actionOk, type ActionResult } from "@/types/actions";

export type ExpenseFormInput = z.input<typeof expenseFormSchema>;

function revalidateExpenseViews() {
  revalidatePath("/admin/expenses");
  revalidatePath("/admin/sales");
  revalidatePath("/admin");
}

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof UnauthorizedError) return error.message;
  if (error instanceof z.ZodError) return error.issues[0]?.message ?? fallback;
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2025") return "That expense no longer exists.";
    if (error.code === "P2003") return "That expense category no longer exists.";
  }
  console.error("[expenses action]", error);
  return fallback;
}

export async function upsertExpense(
  rawInput: ExpenseFormInput
): Promise<ActionResult<{ id: string }>> {
  try {
    await requirePermission("MANAGE_EXPENSES");
    const input = expenseFormSchema.parse(rawInput);

    const data = {
      categoryId: input.categoryId,
      description: input.description?.trim() || null,
      amount: input.amount,
      expenseDate: new Date(input.expenseDate),
    };

    const expense = input.id
      ? await prisma.expense.update({ where: { id: input.id }, data })
      : await prisma.expense.create({ data });

    revalidateExpenseViews();
    return actionOk({ id: expense.id });
  } catch (error) {
    return actionError(toErrorMessage(error, "Could not save the expense."));
  }
}

export async function deleteExpense(expenseId: string): Promise<ActionResult<null>> {
  try {
    await requirePermission("MANAGE_EXPENSES");
    await prisma.expense.delete({ where: { id: expenseId } });
    revalidateExpenseViews();
    return actionOk(null);
  } catch (error) {
    return actionError(toErrorMessage(error, "Could not delete the expense."));
  }
}
