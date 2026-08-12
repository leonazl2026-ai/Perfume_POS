import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { AdminNav } from "@/components/admin/AdminNav";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { logout } from "@/actions/auth";
import { getCurrentUser } from "@/lib/session";
import { hasPermission, permissionForRoute } from "@/lib/permissions";
import { getTranslator } from "@/lib/i18n/server";

function SignOutButton({ label, className }: { label: string; className?: string }) {
  return (
    <form action={logout}>
      <button
        type="submit"
        className={className ?? "text-xs font-medium text-gray-500 transition hover:text-gray-900"}
      >
        {label}
      </button>
    </form>
  );
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { t } = await getTranslator();
  const user = await getCurrentUser();

  // Middleware proves the session is valid but cannot reach the database, so
  // the per-permission decision is made here where Prisma is available.
  if (!user) redirect("/login");

  // Injected by middleware — layouts have no direct access to the pathname.
  const headerList = await headers();
  const pathname = headerList.get("x-pathname") ?? "";

  const required = permissionForRoute(pathname);
  if (required && !hasPermission(user, required)) {
    redirect("/admin/denied");
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-gray-200 bg-white px-3 py-4 lg:flex">
        <div className="px-3 pb-4">
          <p className="text-sm font-semibold text-gray-900">Perfume POS</p>
          <p className="truncate text-xs text-gray-500">
            {user.name} · {user.role}
          </p>
        </div>

        <AdminNav permissions={user.permissions} />

        <div className="mt-auto space-y-2 pt-4">
          <div className="px-1">
            <LanguageSwitcher />
          </div>
          {hasPermission(user, "POS_ACCESS") && (
            <Link
              href="/pos"
              className="block rounded-lg bg-emerald-600 px-3 py-2 text-center text-sm font-medium text-white transition hover:bg-emerald-700"
            >
              {t("nav.openPos")}
            </Link>
          )}
          <div className="px-3">
            <SignOutButton label={t("nav.signOut")} />
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="border-b border-gray-200 bg-white px-4 py-3 lg:hidden">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="truncate text-sm font-semibold text-gray-900">{user.name}</p>
            <div className="flex shrink-0 items-center gap-3">
              <LanguageSwitcher compact />
              <SignOutButton label={t("nav.signOut")} />
              {hasPermission(user, "POS_ACCESS") && (
                <Link href="/pos" className="text-xs font-medium text-emerald-600">
                  {t("nav.openPos")} →
                </Link>
              )}
            </div>
          </div>
          <div className="overflow-x-auto">
            <AdminNav permissions={user.permissions} orientation="horizontal" />
          </div>
        </div>

        <main className="min-w-0 flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
