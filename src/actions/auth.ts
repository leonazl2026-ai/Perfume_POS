"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  createSessionToken,
  safeEqual,
} from "@/lib/auth";
import { actionError, actionOk, type ActionResult } from "@/types/actions";

/** Blunt throttle against password guessing on a single-secret login. */
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

export async function login(password: string): Promise<ActionResult<null>> {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    console.error("[login] ADMIN_PASSWORD is not set");
    return actionError("Login is not configured. Set ADMIN_PASSWORD in .env");
  }

  // In-memory and per-process — fine for a single-shop deployment, but it
  // resets on restart and does not span instances.
  if (isRateLimited("admin")) {
    return actionError("Too many attempts. Wait a minute and try again.");
  }

  if (!safeEqual(password, expected)) {
    return actionError("Incorrect password.");
  }

  const store = await cookies();
  store.set(SESSION_COOKIE, await createSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });

  attempts.delete("admin");
  return actionOk(null);
}

export async function logout(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect("/login");
}
