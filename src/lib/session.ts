import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE, readSessionToken } from "@/lib/auth";
import { UnauthorizedError } from "@/lib/errors";
import {
  PERMISSIONS,
  effectivePermissions,
  hasPermission,
  parsePermissions,
  type Permission,
} from "@/lib/permissions";

/** Server-side session reads. Not usable from middleware — see lib/auth.ts. */

export interface SessionUser {
  id: string;
  name: string;
  username: string;
  role: string;
  /** Already expanded: an ADMIN carries every permission. */
  permissions: Permission[];
}

/**
 * The user for the current request, or null.
 *
 * A session whose user has since been deleted or deactivated resolves to
 * null, so revoking access takes effect on the next request rather than
 * whenever the cookie happens to expire.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const claims = await readSessionToken(store.get(SESSION_COOKIE)?.value);
  if (!claims) return null;

  // Legacy session from the env-password fallback: full access, no user row.
  if (!claims.uid) {
    return {
      id: "env-admin",
      name: "Administrator",
      username: "admin",
      role: "ADMIN",
      permissions: [...PERMISSIONS],
    };
  }

  const user = await prisma.user.findUnique({ where: { id: claims.uid } });
  if (!user || !user.isActive) return null;

  const permissions = parsePermissions(user.permissions);

  return {
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role,
    permissions: effectivePermissions({ role: user.role, permissions }),
  };
}

export async function isAuthenticated(): Promise<boolean> {
  return (await getCurrentUser()) !== null;
}

export { UnauthorizedError };

/** Guard for any admin action: signed in at all. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

/**
 * Guard for a specific capability. Every mutating action calls this rather
 * than relying on the sidebar hiding a link — the UI is a convenience, the
 * server check is the actual boundary.
 */
export async function requirePermission(permission: Permission): Promise<SessionUser> {
  const user = await requireAdmin();

  if (!hasPermission(user, permission)) {
    throw new UnauthorizedError(
      "You do not have permission to do that. Ask an administrator for access."
    );
  }

  return user;
}

export async function currentUserCan(permission: Permission): Promise<boolean> {
  return hasPermission(await getCurrentUser(), permission);
}
