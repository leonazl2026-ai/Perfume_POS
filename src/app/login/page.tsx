import { redirect } from "next/navigation";
import Link from "next/link";
import { LoginForm } from "@/components/auth/LoginForm";
import { isAuthenticated } from "@/lib/session";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;

  // Already signed in — skip the form.
  if (await isAuthenticated()) redirect("/admin");

  const next = typeof params.next === "string" ? params.next : "/admin";

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold text-gray-900">Perfume POS</h1>
          <p className="mt-1 text-sm text-gray-500">Admin sign in</p>
        </div>

        <LoginForm next={next} />

        <p className="mt-4 text-center text-xs text-gray-400">
          Cashiers can go straight to the{" "}
          <Link href="/pos" className="font-medium text-gray-600 underline hover:text-gray-900">
            POS screen
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
