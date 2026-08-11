"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adjustCustomerPoints, fetchLoyaltyHistory } from "@/actions/loyalty";
import { formatCurrency } from "@/lib/format";
import { formatDateTime } from "@/lib/dateRange";
import { LOYALTY_TYPE_LABELS, LOYALTY_TYPE_STYLES, pointsToValue } from "@/lib/loyalty";
import { Modal } from "@/components/ui/Modal";
import type { LoyaltyConfig } from "@/lib/settings";
import type { CustomerRow, LoyaltyLogRow } from "@/types/crm";

interface LoyaltyDialogProps {
  customer: CustomerRow | null;
  loyalty: LoyaltyConfig;
  onClose: () => void;
  onAdjusted: (message: string) => void;
}

/** Points ledger plus manual adjustment for one customer. */
export function LoyaltyDialog({
  customer,
  loyalty,
  onClose,
  onAdjusted,
}: LoyaltyDialogProps) {
  const router = useRouter();
  const [history, setHistory] = useState<LoyaltyLogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const customerId = customer?.id ?? null;

  const load = useCallback(() => {
    if (!customerId) return;
    setLoading(true);
    fetchLoyaltyHistory(customerId)
      .then(setHistory)
      .finally(() => setLoading(false));
  }, [customerId]);

  useEffect(() => {
    if (!customerId) {
      setHistory([]);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetchLoyaltyHistory(customerId)
      .then((rows) => {
        if (!cancelled) setHistory(rows);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [customerId]);

  if (!customer) return null;

  const adjust = (sign: 1 | -1) => {
    const parsed = Math.trunc(Number.parseFloat(amount));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError("Enter a number of points greater than 0.");
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await adjustCustomerPoints({
        customerId: customer.id,
        points: sign * parsed,
        note,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setAmount("");
      setNote("");
      onAdjusted(`Balance is now ${result.data.balance} points.`);
      load();
      router.refresh();
    });
  };

  return (
    <Modal
      open={Boolean(customer)}
      onClose={onClose}
      title={`Points — ${customer.name ?? customer.phone ?? "Customer"}`}
      subtitle={`${customer.points} points · worth ${formatCurrency(
        pointsToValue(customer.points, loyalty)
      )}`}
      widthClass="max-w-2xl"
    >
      <div className="space-y-4">
        {!loyalty.enabled && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            The loyalty system is currently disabled in Settings. Existing balances are kept but
            nothing is earned or redeemable.
          </p>
        )}

        {/* Manual adjustment */}
        <section className="rounded-lg border border-gray-200 p-3">
          <h3 className="mb-1 text-sm font-semibold text-gray-900">Manual adjustment</h3>
          <p className="mb-3 text-xs text-gray-500">
            Goodwill gestures, migrated balances, or fixing a mis-keyed sale. Recorded in the
            ledger below.
          </p>

          {error && (
            <p className="mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="flex flex-wrap items-end gap-2">
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium text-gray-600">Points</span>
              <input
                type="number"
                min="1"
                step="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="w-24 rounded-md border border-gray-300 px-2.5 py-1.5 text-sm outline-none focus:border-gray-900"
              />
            </label>

            <label className="block min-w-[10rem] flex-1">
              <span className="mb-1 block text-[11px] font-medium text-gray-600">Reason</span>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Why this adjustment?"
                className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm outline-none focus:border-gray-900"
              />
            </label>

            <button
              type="button"
              disabled={isPending}
              onClick={() => adjust(1)}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:bg-gray-300"
            >
              Add
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => adjust(-1)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:border-red-600 hover:text-red-600 disabled:opacity-50"
            >
              Deduct
            </button>
          </div>
        </section>

        {/* Ledger */}
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
            Point history
          </h3>

          {loading ? (
            <p className="py-8 text-center text-sm text-gray-400">Loading…</p>
          ) : history.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">No point activity yet.</p>
          ) : (
            <ul className="max-h-72 divide-y divide-gray-100 overflow-y-auto">
              {history.map((entry) => (
                <li key={entry.id} className="flex items-start justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${LOYALTY_TYPE_STYLES[entry.type]}`}
                      >
                        {LOYALTY_TYPE_LABELS[entry.type]}
                      </span>
                      {entry.saleNumber && (
                        <span className="font-mono text-[10px] text-gray-400">
                          {entry.saleNumber}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-gray-500">
                      {entry.description ?? "—"}
                    </p>
                    <p className="text-[10px] text-gray-400">
                      {formatDateTime(new Date(entry.createdAt))}
                    </p>
                  </div>

                  <span
                    className={`shrink-0 text-sm font-semibold tabular-nums ${
                      entry.points >= 0 ? "text-emerald-600" : "text-gray-700"
                    }`}
                  >
                    {entry.points > 0 ? "+" : ""}
                    {entry.points}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Modal>
  );
}
