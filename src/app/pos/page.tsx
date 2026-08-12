import Link from "next/link";
import { redirect } from "next/navigation";
import { PosTerminal } from "@/components/pos/PosTerminal";
import { getPosCatalog } from "@/lib/queries";
import { getSettings, loyaltyConfig } from "@/lib/settings";
import { getCurrentUser } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";

// Stock levels must always reflect the latest sale, never a cached render.
export const dynamic = "force-dynamic";

export default async function PosPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/pos");
  if (!hasPermission(user, "POS_ACCESS")) redirect("/admin/denied");

  const [catalog, settings] = await Promise.all([getPosCatalog(), getSettings()]);

  if (catalog.variants.length === 0 && catalog.bundles.length === 0) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-8 text-center">
        <h1 className="text-xl font-semibold text-gray-900">No products yet</h1>
        <p className="max-w-md text-sm text-gray-500">
          Add product batches in the admin area, or run{" "}
          <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs">
            npm run prisma:seed
          </code>{" "}
          to load sample inventory.
        </p>
        <Link
          href="/admin"
          className="mt-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800"
        >
          Go to Admin
        </Link>
      </main>
    );
  }

  return (
    <PosTerminal
      catalog={catalog}
      loyalty={loyaltyConfig(settings)}
      userName={user.name}
      // Margin figures are hidden from cashiers who cannot see analytics.
      canViewProfit={hasPermission(user, "VIEW_ANALYTICS")}
    />
  );
}
