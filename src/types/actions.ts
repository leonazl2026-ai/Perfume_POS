/**
 * Uniform return shape for every mutating server action. Next.js masks
 * thrown server-action errors in production builds, so failures are returned
 * as data instead of thrown.
 */
export type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string };

export const actionOk = <T>(data: T): ActionResult<T> => ({ ok: true, data });
export const actionError = (error: string): ActionResult<never> => ({ ok: false, error });
