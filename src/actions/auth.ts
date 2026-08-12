"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  createSessionToken,
  safeEqual,
} from "@/lib/auth";
import { verifyPassword } from "@/lib/password";
import { actionError, actionOk, type ActionResult } from "@/types/actions";

/** Blunt throttle against password guessing, keyed per username. */
const attempts = new Map<string, { count: number; firstAt: number }>();
const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 8;

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const record = attempts.get(key);

  if (!record || now - record.firstAt > WINDOW_MS) {
    attempts.set(key, { count: 1, firstAt: now });
    return false;
  }

  record.count += 1;
  return record.count > MAX_ATTEMPTS;
}

async function startSession(userId?: string) {
  const store = await cookies();
  store.set(SESSION_COOKIE, await createSessionToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

/**
 * Signs in against the User table.
 *
 * Fallback: while no active user exists — a fresh database, or one where every
 * account was deactivated — ADMIN_PASSWORD from the environment is accepted so
 * the shop cannot lock itself out. That path closes automatically as soon as
 * one active user exists.
 */
export async function login(
  username: string,
  password: string
): Promise<ActionResult<null>> {
  const handle = username.trim().toLowerCase();

  if (!handle || !password) {
    return actionError("Enter your username and password.");
  }

  if (isRateLimited(handle)) {
    return actionError("Too many attempts. Wait a minute and try again.");
  }

  const user = await prisma.user.findFirst({
    where: { username: handle, isActive: true },
  });

  if (user) {
    if (!(await verifyPassword(password, user.passwordHash))) {
      return actionError("Incorrect username or password.");
    }

    await startSession(user.id);
    attempts.delete(handle);
    return actionOk(null);
  }

  const activeUsers = await prisma.user.count({ where: { isActive: true } });
  if (activeUsers === 0) {
    const envPassword = process.env.ADMIN_PASSWORD;

    if (envPassword && safeEqual(password, envPassword)) {
      console.warn(
        "[login] Signed in with ADMIN_PASSWORD because no active user exists. " +
          "Run `npm run prisma:seed` and create real accounts."
      );
      await startSession();
      attempts.delete(handle);
      return actionOk(null);
    }
  }

  // Same message whether the username or the password was wrong, so the form
  // cannot be used to enumerate valid usernames.
  return actionError("Incorrect username or password.");
}

export async function logout(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect("/login");
}
