"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { handleReturn } from "@/actions/returns";
import { formatCurrency } from "@/lib/format";
import { Modal } from "@/components/ui/Modal";
import type { SaleRow } from "@/types/reports";

type Condition = "RETURNED_GOOD" | "RETURNED_DAMAGED";

const OPTIONS: {
  id: Condition;
  title: string;
  titleMm: string;
  effect: string;
}[] = [
  {
    id: "RETURNED_GOOD",
    title: "Good Condition",
    titleMm: "အကောင်းအတိုင်း",
    effect: "Items go back into their original batches and can be sold again.",
  },
  {
    id: "RETURNED_DAMAGED",
    title: "Damaged",
    titleMm: "Courier ကြောင့် ပျက်စီး",
    effect:
      "Nothing is restocked. The cost of the goods is written off as wastage so net profit absorbs it.",
  },
];

interface ReturnDialogProps {
  sale: SaleRow | null;
  onClose: () => void;
  onDone: (message: string) => void;
}

/**
 * Return handling is destructive in both directions — it either moves stock
 * or writes money off — so it is always an explicit, described choice.
 */
export function ReturnDialog({ sale, onClose, onDone }: ReturnDialogProps) {
  const router = useRouter();
  const [condition, setCondition] = useState<Condition>("RETURNED_GOOD");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!sale) return null;

  const submit = () => {
    setError(null);

    startTransition(async () => {
      const result = await handleReturn({ saleId: sale.id, condition, notes });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      onDone(
        result.data.condition === "RETURNED_GOOD"
          ? `${sale.saleNumber} returned — stock restored to ${result.data.restockedVariants} batch(es).`
          : `${sale.saleNumber} returned damaged — ${formatCurrency(
              result.data.lossValue
            )} written off.`
      );
      onClose();
      router.refresh();
    });
  };

  return (
    <Modal
      open={Boolean(sale)}
      onClose={onClose}
      title="Handle Returned Order"
      subtitle={`${sale.saleNumber} · ${sale.customerName ?? "Walk-in"} · ${formatCurrency(
        sale.total
      )}`}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-gray-900 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={isPending}
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition disabled:bg-gray-300 ${
              condition === "RETURNED_DAMAGED"
                ? "bg-red-600 hover:bg-red-700"
                : "bg-gray-900 hover:bg-gray-800"
            }`}
          >
            {isPending ? "Processing…" : "Confirm return"}
          </button>
        </>
      }
    >
      {error && (
        <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="space-y-3">
        <div className="space-y-2">
          {OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setCondition(option.id)}
              className={`w-full rounded-lg border p-3 text-left transition ${
                condition === option.id
                  ? option.id === "RETURNED_DAMAGED"
                    ? "border-red-500 bg-red-50"
                    : "border-emerald-500 bg-emerald-50"
                  : "border-gray-200 hover:border-gray-400"
              }`}
            >
              <span className="block text-sm font-medium text-gray-900">
                {option.title} / {option.titleMm}
              </span>
              <span className="mt-0.5 block text-xs text-gray-600">{option.effect}</span>
            </button>
          ))}
        </div>

        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-gray-600">
            Return notes / courier claim
          </span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="e.g. Bottle leaked during Royal Express transit — claim #12345"
            className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm outline-none transition focus:border-gray-900"
          />
        </label>

        <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
          The order leaves gross sales either way, and any loyalty points it
          earned or redeemed are reversed.
        </p>
      </div>
    </Modal>
  );
}
