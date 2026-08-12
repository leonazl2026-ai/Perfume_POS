"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { NotFoundError, UnauthorizedError } from "@/lib/errors";
import { getCurrentUser, requirePermission } from "@/lib/session";
import { hashPassword } from "@/lib/password";
import { parsePermissions, serializePermissions, type Permission } from "@/lib/permissions";
import { userFormSchema } from "@/lib/validators";
import { actionError, actionOk, type ActionResult } from "@/types/actions";
import type { UserRow } from "@/types/users";

export type UserFormInput = z.input<typeof userFormSchema>;

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof UnauthorizedError) return error.message;
  if (error instanceof NotFoundError) return error.message;
  if (error instanceof z.ZodError) return error.issues[0]?.message ?? fallback;
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") return "That username is already taken.";
    if (error.code === "P2025") return "That account no longer exists.";
  }
  console.error("[users action]", error);
  return fallback;
}

export async function listUsers(): Promise<UserRow[]> {
  await requirePermission("MANAGE_USERS");

  const rows = await prisma.user.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });

  return rows.map((user) => ({
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role,
    permissions: parsePermissions(user.permissions),
    isActive: user.isActive,
    createdAt: user.createdAt.toISOString(),
  }));
}

export async function upsertUser(
  rawInput: UserFormInput
): Promise<ActionResult<{ id: string }>> {
  try {
    await requirePermission("MANAGE_USERS");
    const input = userFormSchema.parse(rawInput);

    const username = input.username.trim().toLowerCase();
    const permissions = serializePermissions(input.permissions as Permission[]);

    if (input.id) {
      const existing = await prisma.user.findUnique({ where: { id: input.id } });
      if (!existing) throw new NotFoundError("That account no longer exists.");

      // Password is only rewritten when a new one was actually typed.
      const passwordHash = input.password?.trim()
        ? await hashPassword(input.password)
        : undefined;

      await prisma.user.update({
        where: { id: input.id },
        data: {
          name: input.name.trim(),
          username,
          role: input.role,
          permissions,
          ...(passwordHash ? { passwordHash } : {}),
        },
      });

      revalidatePath("/admin/users");
      return actionOk({ id: input.id });
    }

    if (!input.password?.trim()) {
      return actionError("A password is required for a new account.");
    }

    const created = await prisma.user.create({
      data: {
        name: input.name.trim(),
        username,
        role: input.role,
        permissions,
        passwordHash: await hashPassword(input.password),
      },
    });

    revalidatePath("/admin/users");
    return actionOk({ id: created.id });
  } catch (error) {
    return actionError(toErrorMessage(error, "Could not save the account."));
  }
}

/**
 * Deactivating is preferred over deleting — it revokes access on the next
 * request while keeping the account's identity readable in any audit trail.
 */
export async function setUserActive(
  userId: string,
  isActive: boolean
): Promise<ActionResult<null>> {
  try {
    const actor = await requirePermission("MANAGE_USERS");

    if (!isActive) {
      if (actor.id === userId) {
        return actionError("You cannot deactivate your own account.");
      }
      if (await isLastActiveAdmin(userId)) {
        return actionError("This is the last active administrator — keep one enabled.");
      }
    }

    await prisma.user.update({ where: { id: userId }, data: { isActive } });
    revalidatePath("/admin/users");
    return actionOk(null);
  } catch (error) {
    return actionError(toErrorMessage(error, "Could not update the account."));
  }
}

export async function deleteUser(userId: string): Promise<ActionResult<null>> {
  try {
    const actor = await requirePermission("MANAGE_USERS");

    if (actor.id === userId) {
      return actionError("You cannot delete your own account.");
    }
    if (await isLastActiveAdmin(userId)) {
      return actionError("This is the last active administrator — keep one enabled.");
    }

    await prisma.user.delete({ where: { id: userId } });
    revalidatePath("/admin/users");
    return actionOk(null);
  } catch (error) {
    return actionError(toErrorMessage(error, "Could not delete the account."));
  }
}

/** Guard against removing the only way back into the system. */
async function isLastActiveAdmin(userId: string): Promise<boolean> {
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target || target.role !== "ADMIN" || !target.isActive) return false;

  const otherAdmins = await prisma.user.count({
    where: { role: "ADMIN", isActive: true, id: { not: userId } },
  });

  return otherAdmins === 0;
}

/** Profile shown in the header. */
export async function fetchCurrentUser() {
  return getCurrentUser();
}
