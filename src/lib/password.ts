import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

/**
 * Password hashing with scrypt from Node's standard library.
 *
 * Deliberately no bcrypt/argon2 dependency: scrypt is memory-hard, built in,
 * and needs no native build step on a shop's Windows machine. This module is
 * Node-only — never import it from middleware, which runs on the Edge runtime.
 */

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keylen: number
) => Promise<Buffer>;

const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const PREFIX = "scrypt";

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const derived = await scrypt(password, salt, KEY_LENGTH);
  return `${PREFIX}$${salt.toString("hex")}$${derived.toString("hex")}`;
}

/**
 * Constant-time verification. Returns false for malformed hashes rather than
 * throwing, so a corrupt row denies access instead of crashing the login.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== PREFIX) return false;

  const [, saltHex, hashHex] = parts;

  try {
    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(hashHex, "hex");
    if (salt.length !== SALT_LENGTH || expected.length !== KEY_LENGTH) return false;

    const derived = await scrypt(password, salt, KEY_LENGTH);
    return timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}
