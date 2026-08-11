import Link from "next/link";
import { PosTerminal } from "@/components/pos/PosTerminal";
import { getPosCatalog } from "@/lib/queries";

// Stock levels must always reflect the latest sale, never a cached render.
export const dynamic = "force-dynamic";

export default async function PosPage() {
  const catalog = await getPosCatalog();

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

  return <PosTerminal catalog={catalog} />;
}
