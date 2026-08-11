import Link from "next/link";
import { AdminNav } from "@/components/admin/AdminNav";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { logout } from "@/actions/auth";
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

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-gray-200 bg-white px-3 py-4 lg:flex">
        <div className="px-3 pb-4">
          <p className="text-sm font-semibold text-gray-900">Perfume POS</p>
          <p className="text-xs text-gray-500">{t("nav.admin")}</p>
        </div>

        <AdminNav />

        <div className="mt-auto space-y-2 pt-4">
          <div className="px-1">
            <LanguageSwitcher />
          </div>
          <Link
            href="/pos"
            className="block rounded-lg bg-emerald-600 px-3 py-2 text-center text-sm font-medium text-white transition hover:bg-emerald-700"
          >
            {t("nav.openPos")}
          </Link>
          <div className="px-3">
            <SignOutButton label={t("nav.signOut")} />
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile nav — the sidebar is hidden below lg. */}
        <div className="border-b border-gray-200 bg-white px-4 py-3 lg:hidden">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="truncate text-sm font-semibold text-gray-900">Perfume POS</p>
            <div className="flex shrink-0 items-center gap-3">
              <LanguageSwitcher compact />
              <SignOutButton label={t("nav.signOut")} />
              <Link href="/pos" className="text-xs font-medium text-emerald-600">
                {t("nav.openPos")} →
              </Link>
            </div>
          </div>
          <div className="overflow-x-auto">
            <AdminNav orientation="horizontal" />
          </div>
        </div>

        <main className="min-w-0 flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
