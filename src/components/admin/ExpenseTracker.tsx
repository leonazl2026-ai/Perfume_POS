"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { deleteExpense, upsertExpense } from "@/actions/expenses";
import { formatCurrency } from "@/lib/format";
import { formatDate, toDateInputValue, type RangePreset } from "@/lib/dateRange";
import { DateRangeFilter, useFilterParams } from "@/components/admin/FilterBar";
import { ExportButton } from "@/components/admin/ExportButton";
import { Toast, type ToastMessage } from "@/components/ui/Toast";
import type {
  ExpenseCategoryOption,
  ExpenseCategoryTotal,
  ExpenseRow,
} from "@/types/reports";

interface ExpenseTrackerProps {
  categories: ExpenseCategoryOption[];
  expenses: ExpenseRow[];
  totals: ExpenseCategoryTotal[];
  preset: RangePreset;
  rangeLabel: string;
}

export function ExpenseTracker({
  categories,
  expenses,
  totals,
  preset,
  rangeLabel,
}: ExpenseTrackerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setParams = useFilterParams();

  const activeCategoryId = searchParams.get("categoryId") ?? "";

  const [editingId, setEditingId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(() => toDateInputValue(new Date()));
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [isPending, startTransition] = useTransition();

  const grandTotal = totals.reduce((sum, t) => sum + t.total, 0);
  const selectedCategory = categories.find((c) => c.id === categoryId);

  const resetForm = () => {
    setEditingId(null);
    setAmount("");
    setDescription("");
    setDate(toDateInputValue(new Date()));
    setCategoryId(categories[0]?.id ?? "");
    setError(null);
  };

  const handleSubmit = () => {
    setError(null);
    startTransition(async () => {
      const result = await upsertExpense({
        id: editingId ?? undefined,
        categoryId,
        amount: Number.parseFloat(amount) || 0,
        description,
        expenseDate: date,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setToast({
        id: Date.now(),
        kind: "success",
        text: editingId ? "Expense updated." : "Expense recorded.",
      });
      resetForm();
      router.refresh();
    });
  };

  const startEdit = (expense: ExpenseRow) => {
    setEditingId(expense.id);
    setCategoryId(expense.categoryId);
    setAmount(String(expense.amount));
    setDescription(expense.description ?? "");
    setDate(toDateInputValue(new Date(expense.expenseDate)));
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = (expense: ExpenseRow) => {
    startTransition(async () => {
      const result = await deleteExpense(expense.id);
      setToast({
        id: Date.now(),
        kind: result.ok ? "success" : "error",
        text: result.ok ? "Expense deleted." : result.error,
      });
      if (result.ok) router.refresh();
    });
  };

  return (
    <div>
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Expenses</h1>
          <p className="text-sm text-gray-500">
            {rangeLabel} · {formatCurrency(grandTotal)} total
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ExportButton endpoint="/api/export/expenses" />
          <DateRangeFilter preset={preset} />
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[360px_1fr]">
        {/* Entry form + category totals */}
        <div className="space-y-4">
          <section className="rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-gray-900">
              {editingId ? "Edit expense" : "Record expense"}
            </h2>

            {error && (
              <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}

            <div className="space-y-2">
              <label className="block">
                <span className="mb-1 block text-[11px] font-medium text-gray-600">Category</span>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className={inputClass}
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {selectedCategory?.description && (
                  <span className="mt-1 block text-[11px] leading-snug text-gray-400">
                    {selectedCategory.description}
                  </span>
                )}
              </label>

              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="mb-1 block text-[11px] font-medium text-gray-600">Amount</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className={inputClass}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] font-medium text-gray-600">Date</span>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className={inputClass}
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-1 block text-[11px] font-medium text-gray-600">
                  Description
                </span>
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. 500x thermal labels"
                  className={inputClass}
                />
              </label>
            </div>

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isPending || !categoryId || amount.trim() === ""}
                className="flex-1 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 disabled:bg-gray-200 disabled:text-gray-400"
              >
                {isPending ? "Saving…" : editingId ? "Update" : "Add Expense"}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  disabled={isPending}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-gray-900 disabled:opacity-50"
                >
                  Cancel
                </button>
              )}
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-gray-900">By category</h2>

            <ul className="space-y-2">
              {totals.map((row) => {
                const share = grandTotal > 0 ? (row.total / grandTotal) * 100 : 0;
                const active = activeCategoryId === row.categoryId;

                return (
                  <li key={row.categoryId}>
                    <button
                      type="button"
                      onClick={() =>
                        setParams({ categoryId: active ? undefined : row.categoryId })
                      }
                      className="w-full text-left"
                    >
                      <div className="flex items-baseline justify-between gap-2 text-xs">
                        <span
                          className={`truncate ${
                            active ? "font-semibold text-gray-900" : "text-gray-600"
                          }`}
                        >
                          {row.categoryName}
                        </span>
                        <span className="shrink-0 tabular-nums text-gray-900">
                          {formatCurrency(row.total)}
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100">
                        <div
                          className={active ? "h-full bg-gray-900" : "h-full bg-gray-400"}
                          style={{ width: `${share}%` }}
                        />
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>

            {activeCategoryId && (
              <button
                type="button"
                onClick={() => setParams({ categoryId: undefined })}
                className="mt-3 text-xs font-medium text-gray-500 transition hover:text-gray-900"
              >
                Clear category filter
              </button>
            )}
          </section>
        </div>

        {/* Ledger */}
        <section className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full min-w-[36rem] text-sm">
            <thead className="border-b border-gray-100 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Date</th>
                <th className="px-4 py-2.5 font-medium">Category</th>
                <th className="px-4 py-2.5 font-medium">Description</th>
                <th className="px-4 py-2.5 text-right font-medium">Amount</th>
                <th className="px-4 py-2.5 text-right font-medium">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {expenses.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-sm text-gray-400">
                    No expenses recorded for this period.
                  </td>
                </tr>
              ) : (
                expenses.map((expense) => (
                  <tr key={expense.id}>
                    <td className="whitespace-nowrap px-4 py-2.5 text-gray-600">
                      {formatDate(new Date(expense.expenseDate))}
                    </td>
                    <td className="px-4 py-2.5 text-gray-900">{expense.categoryName}</td>
                    <td className="px-4 py-2.5 text-gray-500">{expense.description ?? "—"}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right font-medium text-gray-900">
                      {formatCurrency(expense.amount)}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end gap-2 text-xs font-medium">
                        <button
                          type="button"
                          onClick={() => startEdit(expense)}
                          className="text-gray-600 transition hover:text-gray-900"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleDelete(expense)}
                          className="text-gray-400 transition hover:text-red-600 disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>

            {expenses.length > 0 && (
              <tfoot className="border-t border-gray-200 bg-gray-50">
                <tr>
                  <td colSpan={3} className="px-4 py-2.5 text-xs font-medium text-gray-500">
                    {expenses.length} entr{expenses.length === 1 ? "y" : "ies"}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold text-gray-900">
                    {formatCurrency(expenses.reduce((sum, e) => sum + e.amount, 0))}
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </section>
      </div>

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}

const inputClass =
  "w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm outline-none transition focus:border-gray-900";
