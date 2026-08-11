/**
 * Domain error classes shared across server actions.
 *
 * These live here rather than beside the actions that throw them because a
 * file marked "use server" may only export async functions — Next.js turns
 * every export into a callable server endpoint, so an exported class breaks
 * the build. Importing them from a plain module keeps the action files legal.
 */

/** Thrown when a batch cannot cover the requested bottles or millilitres. */
export class InsufficientStockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InsufficientStockError";
  }
}

/** Thrown when a referenced product, bundle, or sale no longer exists. */
export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

/** Thrown by requireAdmin() when there is no valid admin session. */
export class UnauthorizedError extends Error {
  constructor(message = "You must be signed in to do that.") {
    super(message);
    this.name = "UnauthorizedError";
  }
}
