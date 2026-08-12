import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

/**
 * Session gate for the admin area, the till, and CSV exports.
 *
 * Middleware runs on the Edge runtime and cannot reach the database, so it
 * only proves the session cookie is validly signed and unexpired. The
 * per-permission decision happens in the admin layout, which can query
 * Prisma — see lib/permissions.ts for the route table.
 */
export async function middleware(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const { pathname, search } = request.nextUrl;

  if (await verifySessionToken(token)) {
    // Forward the path so server components can resolve which permission the
    // current route needs; there is no other reliable way to read it in a
    // layout.
    const headers = new Headers(request.headers);
    headers.set("x-pathname", pathname);
    return NextResponse.next({ request: { headers } });
  }

  // Exports are fetched programmatically — answer with a status, not a redirect.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/admin/:path*", "/pos/:path*", "/pos", "/api/export/:path*"],
};
