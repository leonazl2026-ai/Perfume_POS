"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { TranslationKey } from "@/lib/i18n";
import type { Permission } from "@/lib/permissions";

const LINKS: {
  href: string;
  key: TranslationKey;
  exact?: boolean;
  /** undefined = always visible. */
  permission?: Permission;
}[] = [
  { href: "/admin", key: "nav.overview", exact: true },
  { href: "/admin/products", key: "nav.products", permission: "MANAGE_PRODUCTS" },
  { href: "/admin/bundles", key: "nav.bundles", permission: "MANAGE_BUNDLES" },
  { href: "/admin/suppliers", key: "nav.suppliers", permission: "MANAGE_SUPPLIERS" },
  { href: "/admin/customers", key: "nav.customers", permission: "VIEW_CUSTOMERS" },
  { href: "/admin/sales", key: "nav.sales", permission: "VIEW_SALES" },
  { href: "/admin/analytics", key: "nav.analytics", permission: "VIEW_ANALYTICS" },
  { href: "/admin/expenses", key: "nav.expenses", permission: "MANAGE_EXPENSES" },
  { href: "/admin/wastage", key: "nav.wastage", permission: "MANAGE_WASTAGE" },
  { href: "/admin/users", key: "nav.users", permission: "MANAGE_USERS" },
  { href: "/admin/settings", key: "nav.settings", permission: "MANAGE_SETTINGS" },
  { href: "/admin/help", key: "nav.help" },
];

/**
 * Hiding a link is a convenience, not a security boundary — the layout
 * redirects and every action re-checks server-side.
 */
export function AdminNav({
  permissions,
  orientation = "vertical",
}: {
  permissions: Permission[];
  orientation?: "vertical" | "horizontal";
}) {
  const pathname = usePathname();
  const { t } = useI18n();

  const visible = LINKS.filter(
    (link) => !link.permission || permissions.includes(link.permission)
  );

  return (
    <nav
      className={
        orientation === "vertical"
          ? "flex flex-col gap-0.5"
          : "flex flex-row gap-1 whitespace-nowrap"
      }
    >
      {visible.map((link) => {
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
