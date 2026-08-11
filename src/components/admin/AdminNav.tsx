"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Overview", exact: true },
  { href: "/admin/products", label: "Products & Stock" },
  { href: "/admin/bundles", label: "Bundle Builder" },
  { href: "/admin/suppliers", label: "Suppliers" },
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/sales", label: "Sales & Reports" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/expenses", label: "Expenses" },
  { href: "/admin/wastage", label: "Wastage Log" },
  { href: "/admin/settings", label: "Settings" },
];

export function AdminNav({
  orientation = "vertical",
}: {
  orientation?: "vertical" | "horizontal";
}) {
  const pathname = usePathname();

  return (
    <nav
      className={
        orientation === "vertical" ? "flex flex-col gap-0.5" : "flex flex-row gap-1 whitespace-nowrap"
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
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
