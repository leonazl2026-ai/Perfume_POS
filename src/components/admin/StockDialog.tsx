"use client";

import { useState, useTransition } from "react";
import { adjustDecantMl, openBottleForDecanting, stockInBottles } from "@/actions/products";
import { logWastage } from "@/actions/wastage";
import { formatCurrency, formatMl } from "@/lib/format";
import { WASTAGE_LABELS, WASTAGE_REASONS, type WastageReasonValue } from "@/lib/wastage";
import { Modal } from "@/components/ui/Modal";
import type { AdminVariant } from "@/types/admin";

interface StockDialogProps {
  variant: AdminVariant | null;
  onClose: () => void;
  onDone: (message: string) => void;
}

/**
 * The three stock movements a batch supports, each writing an
 * InventoryTransaction so the audit trail stays complete.
 */
export function StockDialog({ variant, onClose, onDone }: StockDialogProps) {
  const [stockInQty, setStockInQty] = useState("1");
  const [stockInNote, setStockInNote] = useState("");
  const [newMl, setNewMl] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Loss / spillage write-off
  const [lossReason, setLossReason] = useState<WastageReasonValue>("SPILLAGE");
  const [lossMl, setLossMl] = useState("");
  const [lossBottles, setLossBottles] = useState("");
  const [lossNote, setLossNote] = useState("");

  if (!variant) return null;

  // Live preview of the write-off value, using the same formula as the server:
  // (ml x costPerMl) + (bottles x bottleCost)
  const lossMlValue = Number.parseFloat(lossMl) || 0;
  const lossBottlesValue = Math.trunc(Number.parseFloat(lossBottles) || 0);
  const estimatedLoss =
    lossMlValue * variant.costPerMl + lossBottlesValue * variant.bottleCost;
  const estimatedLossInputsEmpty = lossMlValue <= 0 && lossBottlesValue <= 0;

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, successMessage: string) => {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) {
        setError(result.error ?? "Something went wrong.");
        return;
      }
      onDone(successMessage);
      onClose();
    });
  };

  return (
    <Modal
      open={Boolean(variant)}
      onClose={onClose}
      title={`Stock — ${variant.variantBatchId}`}
      subtitle={`${variant.productName} · ${variant.unopenedBottles} sealed · ${formatMl(
        variant.decantActiveRemainingMl
      )} active`}
    >
      {error && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="space-y-5">
        {/* 1. Receive sealed bottles */}
        <section className="rounded-lg border border-gray-200 p-3">
          <h3 className="mb-2 text-sm font-semibold text-gray-900">Stock in</h3>
          <p className="mb-3 text-xs text-gray-500">Receive new sealed bottles into this batch.</p>
          <div className="flex flex-wrap items-end gap-2">
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium text-gray-600">Bottles</span>
              <input
                type="number"
                min="1"
                step="1"
                value={stockInQty}
                onChange={(e) => setStockInQty(e.target.value)}
                className="w-24 rounded-md border border-gray-300 px-2.5 py-1.5 text-sm outline-none focus:border-gray-900"
              />
            </label>
            <label className="block min-w-[10rem] flex-1">
              <span className="mb-1 block text-[11px] font-medium text-gray-600">Note</span>
              <input
                value={stockInNote}
                onChange={(e) => setStockInNote(e.target.value)}
                placeholder="Supplier / invoice"
                className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm outline-none focus:border-gray-900"
              />
            </label>
            <button
              type="button"
              disabled={isPending}
              onClick={() =>
                run(
                  () =>
                    stockInBottles({
                      variantId: variant.id,
                      quantity: Math.trunc(Number.parseFloat(stockInQty) || 0),
                      note: stockInNote,
                    }),
                  "Stock added."
                )
              }
              className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-gray-800 disabled:bg-gray-300"
            >
              Add
            </button>
          </div>
        </section>

        {/* 2. Move a sealed bottle into the decant pool */}
        <section className="rounded-lg border border-gray-200 p-3">
          <h3 className="mb-2 text-sm font-semibold text-gray-900">Open a bottle for decanting</h3>
          <p className="mb-3 text-xs text-gray-500">
            Moves 1 sealed bottle out of stock and adds {variant.fullBottleSizeMl}ml to the active
            decant pool.
          </p>
          <button
            type="button"
            disabled={isPending || variant.unopenedBottles < 1}
            onClick={() =>
              run(() => openBottleForDecanting({ variantId: variant.id }), "Bottle opened.")
            }
            className="rounded-lg border border-gray-900 px-3 py-1.5 text-sm font-medium text-gray-900 transition hover:bg-gray-900 hover:text-white disabled:border-gray-200 disabled:text-gray-300 disabled:hover:bg-transparent"
          >
            {variant.unopenedBottles < 1 ? "No sealed bottles" : "Open 1 bottle"}
          </button>
        </section>

        {/* 3. Correct the active volume */}
        <section className="rounded-lg border border-gray-200 p-3">
          <h3 className="mb-2 text-sm font-semibold text-gray-900">Adjust active ml</h3>
          <p className="mb-3 text-xs text-gray-500">
            Set the measured remaining volume — for spillage, evaporation, or a recount.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium text-gray-600">
                New remaining ml
              </span>
              <input
                type="number"
                min="0"
                step="0.1"
                value={newMl}
                onChange={(e) => setNewMl(e.target.value)}
                placeholder={String(variant.decantActiveRemainingMl)}
                className="w-28 rounded-md border border-gray-300 px-2.5 py-1.5 text-sm outline-none focus:border-gray-900"
              />
            </label>
            <label className="block min-w-[10rem] flex-1">
              <span className="mb-1 block text-[11px] font-medium text-gray-600">Reason</span>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Spillage, recount…"
                className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm outline-none focus:border-gray-900"
              />
            </label>
            <button
              type="button"
              disabled={isPending || newMl.trim() === ""}
              onClick={() =>
                run(
                  () =>
                    adjustDecantMl({
                      variantId: variant.id,
                      newRemainingMl: Number.parseFloat(newMl) || 0,
                      reason,
                    }),
                  "Decant level adjusted."
                )
              }
              className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-gray-800 disabled:bg-gray-300"
            >
              Adjust
            </button>
          </div>
        </section>

        {/* 4. Write off loss — deducts stock AND books the money as an expense */}
        <section className="rounded-lg border border-red-200 bg-red-50/40 p-3">
          <h3 className="mb-2 text-sm font-semibold text-gray-900">Log loss / spillage</h3>
          <p className="mb-3 text-xs text-gray-500">
            Deducts stock and books the value as an expense under &ldquo;Loss &amp;
            Damaged&rdquo;, so net profit absorbs it.
          </p>

          <div className="mb-2 flex flex-wrap gap-1.5">
            {WASTAGE_REASONS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setLossReason(value)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                  lossReason === value
                    ? "bg-gray-900 text-white"
                    : "border border-gray-200 bg-white text-gray-600 hover:border-gray-900"
                }`}
              >
                {WASTAGE_LABELS[value]}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium text-gray-600">ml lost</span>
              <input
                type="number"
                min="0"
                step="0.1"
                value={lossMl}
                onChange={(e) => setLossMl(e.target.value)}
                placeholder="0"
                className="w-24 rounded-md border border-gray-300 px-2.5 py-1.5 text-sm outline-none focus:border-gray-900"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium text-gray-600">Bottles</span>
              <input
                type="number"
                min="0"
                step="1"
                value={lossBottles}
                onChange={(e) => setLossBottles(e.target.value)}
                placeholder="0"
                className="w-20 rounded-md border border-gray-300 px-2.5 py-1.5 text-sm outline-none focus:border-gray-900"
              />
            </label>
            <label className="block min-w-[8rem] flex-1">
              <span className="mb-1 block text-[11px] font-medium text-gray-600">Note</span>
              <input
                value={lossNote}
                onChange={(e) => setLossNote(e.target.value)}
                placeholder="Optional detail"
                className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm outline-none focus:border-gray-900"
              />
            </label>
          </div>

          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-gray-600">
              Estimated loss:{" "}
              <strong className="text-red-600">{formatCurrency(estimatedLoss)}</strong>
            </p>
            <button
              type="button"
              disabled={isPending || estimatedLossInputsEmpty}
              onClick={() =>
                run(
                  () =>
                    logWastage({
                      variantId: variant.id,
                      reason: lossReason,
                      mlDeducted: Number.parseFloat(lossMl) || 0,
                      bottlesDeducted: Math.trunc(Number.parseFloat(lossBottles) || 0),
                      note: lossNote,
                    }),
                  "Loss recorded and expensed."
                )
              }
              className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-red-700 disabled:bg-gray-300"
            >
              Write off
            </button>
          </div>
        </section>
      </div>
    </Modal>
  );
}
