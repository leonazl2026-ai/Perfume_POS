import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function AccessDeniedPage() {
  const user = await getCurrentUser();

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
      <h1 className="text-lg font-semibold text-gray-900">Access denied</h1>
      <p className="max-w-md text-sm text-gray-500">
        Your account does not have permission to open that page. Ask an administrator if you
        need access.
      </p>

      <div className="mt-2 flex gap-2">
        {user && hasPermission(user, "POS_ACCESS") && (
          <Link
            href="/pos"
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
          >
            Go to POS
          </Link>
        )}
        <Link
          href="/admin"
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-gray-900"
        >
          Back to overview
        </Link>
      </div>
    </div>
  );
}
