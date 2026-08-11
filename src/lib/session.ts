import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

/** Server-side session reads. Not usable from middleware — see lib/auth.ts. */

export async function isAuthenticated(): Promise<boolean> {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
}

export class UnauthorizedError extends Error {
  constructor() {
    super("You must be signed in to do that.");
  }
}

/**
 * Guard for admin server actions.
 *
 * Middleware already blocks admin *page* requests, but a server action is a
 * POST that an attacker could in principle aim at an unprotected route, so
 * every mutating admin action checks the session itself too.
 */
export async function requireAdmin(): Promise<void> {
  if (!(await isAuthenticated())) throw new UnauthorizedError();
}
