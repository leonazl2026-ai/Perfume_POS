/**
 * Session tokens signed with HMAC-SHA256 via Web Crypto.
 *
 * Deliberately dependency-free and Edge-compatible: middleware runs on the
 * Edge runtime where Node's `crypto` module is unavailable, so both the
 * middleware and the server actions share this one implementation.
 *
 * This module must never import `next/headers` — middleware cannot use it.
 */

export const SESSION_COOKIE = "pos_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12h — one trading day

const encoder = new TextEncoder();

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "AUTH_SECRET is missing or too short. Set a random string of at least 16 characters in .env"
    );
  }
  return secret;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(value: string): Uint8Array {
  const padded =
    value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function getKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export interface SessionPayload {
  exp: number;
  /** User row id. Absent on legacy env-password sessions. */
  uid?: string;
}

/** Returns `<payload>.<signature>`, both base64url. */
export async function createSessionToken(
  userId?: string,
  ttlSeconds = SESSION_TTL_SECONDS
): Promise<string> {
  const claims: SessionPayload = {
    exp: Date.now() + ttlSeconds * 1000,
    ...(userId ? { uid: userId } : {}),
  };

  const payload = base64UrlEncode(encoder.encode(JSON.stringify(claims)));
  const signature = await crypto.subtle.sign("HMAC", await getKey(), encoder.encode(payload));
  return `${payload}.${base64UrlEncode(new Uint8Array(signature))}`;
}

/**
 * Verifies the signature and expiry, returning the claims.
 * Never trust the payload without this — it is attacker-supplied otherwise.
 */
export async function readSessionToken(
  token: string | undefined | null
): Promise<SessionPayload | null> {
  if (!token) return null;

  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  try {
    const valid = await crypto.subtle.verify(
      "HMAC",
      await getKey(),
      base64UrlDecode(signature),
      encoder.encode(payload)
    );
    if (!valid) return null;

    const decoded = JSON.parse(
      new TextDecoder().decode(base64UrlDecode(payload))
    ) as SessionPayload;

    if (typeof decoded.exp !== "number" || decoded.exp <= Date.now()) return null;
    return decoded;
  } catch {
    // Malformed token — treat as unauthenticated rather than erroring.
    return null;
  }
}

export async function verifySessionToken(token: string | undefined | null): Promise<boolean> {
  return (await readSessionToken(token)) !== null;
}

/** Length-independent comparison, to avoid leaking the password by timing. */
export function safeEqual(a: string, b: string): boolean {
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  if (left.length !== right.length) return false;

  let diff = 0;
  for (let i = 0; i < left.length; i++) diff |= left[i] ^ right[i];
  return diff === 0;
}
