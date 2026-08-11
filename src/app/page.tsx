import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-gray-900">Perfume & Decant POS</h1>
        <p className="mt-1 text-sm text-gray-500">Inventory, decanting, and bundle sales.</p>
      </div>

      <div className="flex gap-3">
        <Link
          href="/pos"
          className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-gray-800"
        >
          Open POS
        </Link>
        <Link
          href="/admin"
          className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 transition hover:border-gray-900 hover:text-gray-900"
        >
          Admin Dashboard
        </Link>
      </div>
    </main>
  );
}
