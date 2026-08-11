import { ExpenseTracker } from "@/components/admin/ExpenseTracker";
import { parseDateRange } from "@/lib/dateRange";
import {
  getExpenseCategories,
  getExpenses,
  getExpenseTotalsByCategory,
} from "@/lib/reportQueries";

export const dynamic = "force-dynamic";

// Next.js 15: searchParams is a Promise.
type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function AdminExpensesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const range = parseDateRange(params);
  const categoryId = typeof params.categoryId === "string" ? params.categoryId : undefined;

  const [categories, expenses, totals] = await Promise.all([
    getExpenseCategories(),
    getExpenses({ range, categoryId }),
    getExpenseTotalsByCategory(range),
  ]);

  if (categories.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 p-10 text-center">
        <h1 className="text-base font-semibold text-gray-900">No expense categories</h1>
        <p className="mt-1 text-sm text-gray-500">
          Run{" "}
          <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs">
            npm run prisma:seed
          </code>{" "}
          to load the 7 standard categories.
        </p>
      </div>
    );
  }

  return (
    <ExpenseTracker
      categories={categories}
      expenses={expenses}
      totals={totals}
      preset={range.preset}
      rangeLabel={range.label}
    />
  );
}
