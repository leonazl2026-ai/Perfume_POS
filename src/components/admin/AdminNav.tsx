"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { TranslationKey } from "@/lib/i18n";

const LINKS: { href: string; key: TranslationKey; exact?: boolean }[] = [
  { href: "/admin", key: "nav.overview", exact: true },
  { href: "/admin/products", key: "nav.products" },
  { href: "/admin/bundles", key: "nav.bundles" },
  { href: "/admin/suppliers", key: "nav.suppliers" },
  { href: "/admin/customers", key: "nav.customers" },
  { href: "/admin/sales", key: "nav.sales" },
  { href: "/admin/analytics", key: "nav.analytics" },
  { href: "/admin/expenses", key: "nav.expenses" },
  { href: "/admin/wastage", key: "nav.wastage" },
  { href: "/admin/settings", key: "nav.settings" },
  { href: "/admin/help", key: "nav.help" },
];

export function AdminNav({
  orientation = "vertical",
}: {
  orientation?: "vertical" | "horizontal";
}) {
  const pathname = usePathname();
  const { t } = useI18n();

  return (
    <nav
      className={
        orientation === "vertical"
          ? "flex flex-col gap-0.5"
          : "flex flex-row gap-1 whitespace-nowrap"
      }
    >
      {LINKS.map((link) => {
        const active = link.exact ? pathname === link.href : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-lg px-3 py-2 text-sm transition ${
              active
                ? "bg-gray-900 font-medium text-white"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            }`}
          >
            {t(link.key)}
          </Link>
        );
      })}
    </nav>
  );
}
