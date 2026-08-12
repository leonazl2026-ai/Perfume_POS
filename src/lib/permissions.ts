/**
 * Granular permissions.
 *
 * Plain data with no Prisma import, so both server guards and client
 * components can share one definition of what each flag means.
 */

export const PERMISSIONS = [
  "POS_ACCESS",
  "VIEW_CUSTOMERS",
  "MANAGE_PRODUCTS",
  "MANAGE_BUNDLES",
  "MANAGE_SUPPLIERS",
  "VIEW_SALES",
  "VIEW_ANALYTICS",
  "MANAGE_EXPENSES",
  "MANAGE_WASTAGE",
  "MANAGE_SETTINGS",
  "MANAGE_USERS",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const PERMISSION_LABELS: Record<Permission, string> = {
  POS_ACCESS: "POS access",
  VIEW_CUSTOMERS: "View customers",
  MANAGE_PRODUCTS: "Manage products & stock",
  MANAGE_BUNDLES: "Manage bundles",
  MANAGE_SUPPLIERS: "Manage suppliers",
  VIEW_SALES: "View sales & handle returns",
  VIEW_ANALYTICS: "View costs, profit & analytics",
  MANAGE_EXPENSES: "Manage expenses",
  MANAGE_WASTAGE: "Manage wastage",
  MANAGE_SETTINGS: "Manage settings",
  MANAGE_USERS: "Manage users",
};

export const PERMISSION_DESCRIPTIONS: Record<Permission, string> = {
  POS_ACCESS: "Open the till and complete sales.",
  VIEW_CUSTOMERS: "View the CRM, add customers and adjust loyalty points.",
  MANAGE_PRODUCTS: "Add batches, open bottles, adjust decant ml.",
  MANAGE_BUNDLES: "Create and edit bundle sets.",
  MANAGE_SUPPLIERS: "View and edit supplier records.",
  VIEW_SALES: "Sales history, delivery status and returns.",
  VIEW_ANALYTICS: "Cost prices, margins, net profit and reports.",
  MANAGE_EXPENSES: "Record and edit shop expenses.",
  MANAGE_WASTAGE: "Log spillage and revert write-offs.",
  MANAGE_SETTINGS: "Loyalty rates, stock thresholds and shop configuration.",
  MANAGE_USERS: "Create staff accounts and assign permissions.",
};

/** Grouping used by the permission editor. */
export const PERMISSION_GROUPS: { title: string; permissions: Permission[] }[] = [
  { title: "Selling", permissions: ["POS_ACCESS", "VIEW_CUSTOMERS", "VIEW_SALES"] },
  {
    title: "Inventory",
    permissions: ["MANAGE_PRODUCTS", "MANAGE_BUNDLES", "MANAGE_SUPPLIERS", "MANAGE_WASTAGE"],
  },
  { title: "Money", permissions: ["VIEW_ANALYTICS", "MANAGE_EXPENSES"] },
  { title: "Administration", permissions: ["MANAGE_SETTINGS", "MANAGE_USERS"] },
];

export const ROLES = ["ADMIN", "STAFF", "CUSTOM"] as const;
export type Role = (typeof ROLES)[number];

/** One-click presets for the permission editor. */
export const PERMISSION_PRESETS: { id: string; label: string; permissions: Permission[] }[] = [
  {
    id: "cashier",
    label: "Set as Cashier",
    permissions: ["POS_ACCESS", "VIEW_CUSTOMERS"],
  },
  {
    id: "manager",
    label: "Set as Manager",
    permissions: [
      "POS_ACCESS",
      "VIEW_CUSTOMERS",
      "MANAGE_PRODUCTS",
      "MANAGE_BUNDLES",
      "MANAGE_SUPPLIERS",
      "VIEW_SALES",
      "VIEW_ANALYTICS",
      "MANAGE_EXPENSES",
      "MANAGE_WASTAGE",
    ],
  },
  { id: "all", label: "Select All", permissions: [...PERMISSIONS] },
  { id: "none", label: "Clear All", permissions: [] },
];

export const isPermission = (value: unknown): value is Permission =>
  typeof value === "string" && (PERMISSIONS as readonly string[]).includes(value);

/** Parses the stored JSON column, ignoring anything unrecognised. */
export function parsePermissions(raw: string | null | undefined): Permission[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isPermission) : [];
  } catch {
    return [];
  }
}

export const serializePermissions = (permissions: Permission[]): string =>
  JSON.stringify([...new Set(permissions.filter(isPermission))]);

/**
 * ADMIN is deliberately absolute: it short-circuits the permission list so an
 * admin can never be locked out of user management by a bad edit.
 */
export function hasPermission(
  user: { role: string; permissions: Permission[] } | null,
  permission: Permission
): boolean {
  if (!user) return false;
  if (user.role === "ADMIN") return true;
  return user.permissions.includes(permission);
}

export function effectivePermissions(user: {
  role: string;
  permissions: Permission[];
}): Permission[] {
  return user.role === "ADMIN" ? [...PERMISSIONS] : user.permissions;
}

/**
 * Which permission each admin route requires. Used by the sidebar to hide
 * links and by the layout to block direct navigation.
 */
export const ROUTE_PERMISSIONS: { prefix: string; permission: Permission }[] = [
  { prefix: "/admin/products", permission: "MANAGE_PRODUCTS" },
  { prefix: "/admin/bundles", permission: "MANAGE_BUNDLES" },
  { prefix: "/admin/suppliers", permission: "MANAGE_SUPPLIERS" },
  { prefix: "/admin/customers", permission: "VIEW_CUSTOMERS" },
  { prefix: "/admin/sales", permission: "VIEW_SALES" },
  { prefix: "/admin/analytics", permission: "VIEW_ANALYTICS" },
  { prefix: "/admin/expenses", permission: "MANAGE_EXPENSES" },
  { prefix: "/admin/wastage", permission: "MANAGE_WASTAGE" },
  { prefix: "/admin/settings", permission: "MANAGE_SETTINGS" },
  { prefix: "/admin/users", permission: "MANAGE_USERS" },
];

/** null = no specific permission needed (overview, help). */
export function permissionForRoute(pathname: string): Permission | null {
  const match = ROUTE_PERMISSIONS.find((route) => pathname.startsWith(route.prefix));
  return match?.permission ?? null;
}
