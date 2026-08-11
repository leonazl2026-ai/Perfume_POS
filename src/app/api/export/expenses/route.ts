import type { NextRequest } from "next/server";
import { csvResponse, fileStamp, toCsv, type CsvValue } from "@/lib/csv";
import { parseDateRange } from "@/lib/dateRange";
import { getExpenseTotalsByCategory, getExpenses } from "@/lib/reportQueries";
import { isAuthenticated } from "@/lib/session";

export const dynamic = "force-dynamic";

const money = (value: number): string => value.toFixed(2);

/** CSV export honouring the same date/category filters as the Expenses screen. */
export async function GET(request: NextRequest) {
  if (!(await isAuthenticated())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const range = parseDateRange(params);
  const categoryId = params.categoryId || undefined;

  const [expenses, totals] = await Promise.all([
    getExpenses({ range, categoryId }),
    getExpenseTotalsByCategory(range),
  ]);

  const rows: CsvValue[][] = expenses.map((expense) => [
    new Date(expense.expenseDate).toISOString(),
    expense.categoryName,
    expense.description ?? "",
    money(expense.amount),
  ]);

  rows.push([]);
  rows.push(["Period", range.label]);

  // Category totals reflect the whole period, not the category filter.
  for (const total of totals) {
    rows.push([`Total — ${total.categoryName}`, "", `${total.count} entries`, money(total.total)]);
  }
  rows.push(["Grand total", "", "", money(totals.reduce((sum, t) => sum + t.total, 0))]);

  const csv = toCsv(["Date", "Category", "Description", "Amount"], rows);

  return csvResponse(csv, `expenses-${fileStamp()}.csv`);
}
