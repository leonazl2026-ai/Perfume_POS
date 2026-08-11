"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteBundle, setBundleActive, upsertBundle } from "@/actions/bundles";
import { formatCurrency, formatMl } from "@/lib/format";
import { Toast, type ToastMessage } from "@/components/ui/Toast";
import type { AdminBundle, AdminVariant } from "@/types/admin";

/** A constituent currently on the workbench. */
interface DraftItem {
  key: string;
  productVariantId: string;
  label: string;
  sublabel: string;
  itemType: "FULL_BOTTLE" | "DECANT";
  decantSizeMl: number | null;
  unitCost: number;
  quantity: number;
}

/** One addable row in the left-hand picker: a bottle or a specific decant size. */
interface PickerEntry {
  key: string;
  variantId: string;
  productName: string;
  variantBatchId: string;
  itemType: "FULL_BOTTLE" | "DECANT";
  sizeMl: number | null;
  unitCost: number;
  /** Stock context so the admin doesn't build a bundle from an empty batch. */
  availability: string;
  depleted: boolean;
}

const blankDraft = () => ({
  id: undefined as string | undefined,
  name: "",
  sku: "",
  description: "",
  sellingPrice: "",
  items: [] as DraftItem[],
});

type Draft = ReturnType<typeof blankDraft>;

const num = (value: string): number => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export function BundleBuilder({
  bundles,
  variants,
}: {
  bundles: AdminBundle[];
  variants: AdminVariant[];
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(blankDraft);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [isPending, startTransition] = useTransition();

  const notify = (kind: ToastMessage["kind"], text: string) =>
    setToast({ id: Date.now(), kind, text });

  // Flatten every batch into its sellable units — one bottle entry plus one
  // entry per configured decant size.
  const pickerEntries = useMemo<PickerEntry[]>(() => {
    const entries: PickerEntry[] = [];

    for (const v of variants) {
      if (!v.isActive) continue;

      entries.push({
        key: `fb:${v.id}`,
        variantId: v.id,
        productName: v.productName,
        variantBatchId: v.variantBatchId,
        itemType: "FULL_BOTTLE",
        sizeMl: null,
        unitCost: v.bottleCost,
        availability: `${v.unopenedBottles} sealed`,
        depleted: v.unopenedBottles < 1,
      });

      for (const o of v.decantOptions) {
        entries.push({
          key: `dc:${v.id}:${o.sizeMl}`,
          variantId: v.id,
          productName: v.productName,
          variantBatchId: v.variantBatchId,
          itemType: "DECANT",
          sizeMl: o.sizeMl,
          unitCost: o.unitCost,
          availability: `${formatMl(v.decantActiveRemainingMl)} active`,
          depleted: v.decantActiveRemainingMl < o.sizeMl,
        });
      }
    }

    return entries;
  }, [variants]);

  const search = query.trim().toLowerCase();
  const visibleEntries = useMemo(
    () =>
      pickerEntries.filter(
        (e) =>
          !search ||
          e.productName.toLowerCase().includes(search) ||
          e.variantBatchId.toLowerCase().includes(search)
      ),
    [pickerEntries, search]
  );

  const totalCost = draft.items.reduce((sum, i) => sum + i.unitCost * i.quantity, 0);
  const price = num(draft.sellingPrice);
  const profit = price - totalCost;
  const margin = price > 0 ? (profit / price) * 100 : 0;
  const itemsRetail = useMemo(() => {
    // What the constituents would fetch if sold separately — shows the discount.
    return draft.items.reduce((sum, item) => {
      const variant = variants.find((v) => v.id === item.productVariantId);
      if (!variant) return sum;
      const unit =
        item.itemType === "FULL_BOTTLE"
          ? variant.fullBottlePrice
          : variant.decantOptions.find((o) => o.sizeMl === item.decantSizeMl)?.price ?? 0;
      return sum + unit * item.quantity;
    }, 0);
  }, [draft.items, variants]);

  const addEntry = (entry: PickerEntry) => {
    setDraft((d) => {
      const existing = d.items.find((i) => i.key === entry.key);
      if (existing) {
        return {
          ...d,
          items: d.items.map((i) =>
            i.key === entry.key ? { ...i, quantity: i.quantity + 1 } : i
          ),
        };
      }
      return {
        ...d,
        items: [
          ...d.items,
          {
            key: entry.key,
            productVariantId: entry.variantId,
            label: entry.productName,
            sublabel:
              entry.itemType === "FULL_BOTTLE"
                ? `Full Bottle · ${entry.variantBatchId}`
                : `${entry.sizeMl}ml Decant · ${entry.variantBatchId}`,
            itemType: entry.itemType,
            decantSizeMl: entry.sizeMl,
            unitCost: entry.unitCost,
            quantity: 1,
          },
        ],
      };
    });
  };

  const setQuantity = (key: string, quantity: number) =>
    setDraft((d) => ({
      ...d,
      items:
        quantity < 1
          ? d.items.filter((i) => i.key !== key)
          : d.items.map((i) => (i.key === key ? { ...i, quantity } : i)),
    }));

  const loadForEdit = (bundle: AdminBundle) => {
    setError(null);
    setDraft({
      id: bundle.id,
      name: bundle.name,
      sku: bundle.sku,
      description: bundle.description ?? "",
      sellingPrice: String(bundle.price),
      items: bundle.items.map((item) => ({
        key:
          item.itemType === "FULL_BOTTLE"
            ? `fb:${item.productVariantId}`
            : `dc:${item.productVariantId}:${item.decantSizeMl}`,
        productVariantId: item.productVariantId,
        label: item.productName,
        sublabel:
          item.itemType === "FULL_BOTTLE"
            ? `Full Bottle · ${item.variantBatchId}`
            : `${item.decantSizeMl}ml Decant · ${item.variantBatchId}`,
        itemType: item.itemType,
        decantSizeMl: item.decantSizeMl,
        unitCost: item.unitCost,
        quantity: item.quantity,
      })),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSave = () => {
    setError(null);
    startTransition(async () => {
      const result = await upsertBundle({
        id: draft.id,
        name: draft.name,
        sku: draft.sku,
        description: draft.description,
        sellingPrice: num(draft.sellingPrice),
        items: draft.items.map((i) => ({
          productVariantId: i.productVariantId,
          itemType: i.itemType,
          decantSizeMl: i.decantSizeMl,
          quantity: i.quantity,
        })),
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      notify("success", draft.id ? "Bundle updated." : "Bundle created.");
      setDraft(blankDraft());
      router.refresh();
    });
  };

  const handleToggleActive = (bundle: AdminBundle) => {
    startTransition(async () => {
      const result = await setBundleActive({ bundleId: bundle.id, isActive: !bundle.isActive });
      if (!result.ok) {
        notify("error", result.error);
        return;
      }
      notify("success", bundle.isActive ? "Bundle deactivated." : "Bundle reactivated.");
      router.refresh();
    });
  };

  const handleDelete = (bundle: AdminBundle) => {
    startTransition(async () => {
      const result = await deleteBundle(bundle.id);
      // A sold bundle is deactivated rather than deleted; the action explains why.
      notify(result.ok ? "success" : "error", result.ok ? "Bundle deleted." : result.error);
      router.refresh();
    });
  };

  return (
    <div>
      <header className="mb-5">
        <h1 className="text-lg font-semibold text-gray-900">Bundle Builder</h1>
        <p className="text-sm text-gray-500">
          Build a custom set — selling it deducts each constituent from live inventory.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_400px]">
        {/* Item picker */}
        <section className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-gray-900">Add items</h2>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              className="w-48 rounded-lg border border-gray-300 px-3 py-1.5 text-sm outline-none transition focus:border-gray-900"
            />
          </div>

          {visibleEntries.length === 0 ? (
            <p className="rounded-lg border border-dashed border-gray-300 px-3 py-10 text-center text-sm text-gray-500">
              No active batches found. Add products first.
            </p>
          ) : (
            <ul className="max-h-[28rem] divide-y divide-gray-100 overflow-y-auto">
              {visibleEntries.map((entry) => (
                <li key={entry.key} className="flex items-center gap-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {entry.productName}
                    </p>
                    <p className="truncate text-[11px] text-gray-500">
                      {entry.itemType === "FULL_BOTTLE"
                        ? "Full Bottle"
                        : `${entry.sizeMl}ml Decant`}{" "}
                      · {entry.variantBatchId} · cost {formatCurrency(entry.unitCost)}
                    </p>
                  </div>

                  <span
                    className={`shrink-0 text-[11px] ${
                      entry.depleted ? "text-red-500" : "text-gray-400"
                    }`}
                  >
                    {entry.availability}
                  </span>

                  <button
                    type="button"
                    onClick={() => addEntry(entry)}
                    className="shrink-0 rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 transition hover:border-gray-900 hover:text-gray-900"
                  >
                    Add
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Workbench */}
        <section className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">
            {draft.id ? "Editing bundle" : "New bundle"}
          </h2>

          {error && (
            <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="space-y-2">
            <input
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              placeholder="Bundle name — 3x10ml Discovery Set"
              className={inputClass}
            />
            <input
              value={draft.sku}
              onChange={(e) => setDraft((d) => ({ ...d, sku: e.target.value }))}
              placeholder="SKU — BND-DISC-3X10"
              className={`${inputClass} font-mono`}
            />
            <textarea
              value={draft.description}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
              rows={2}
              placeholder="Description (optional)"
              className={inputClass}
            />
          </div>

          <div className="mt-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Contents
            </h3>

            {draft.items.length === 0 ? (
              <p className="rounded-lg border border-dashed border-gray-300 px-3 py-6 text-center text-xs text-gray-500">
                Add items from the left to build this set.
              </p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {draft.items.map((item) => (
                  <li key={item.key} className="flex items-center gap-2 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-gray-900">{item.label}</p>
                      <p className="truncate text-[11px] text-gray-500">
                        {item.sublabel} · {formatCurrency(item.unitCost)} ea
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        aria-label="Decrease quantity"
                        onClick={() => setQuantity(item.key, item.quantity - 1)}
                        className={stepperClass}
                      >
                        −
                      </button>
                      <span className="w-5 text-center text-sm tabular-nums">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        aria-label="Increase quantity"
                        onClick={() => setQuantity(item.key, item.quantity + 1)}
                        className={stepperClass}
                      >
                        +
                      </button>
                    </div>

                    <span className="w-16 shrink-0 text-right text-sm text-gray-900">
                      {formatCurrency(item.unitCost * item.quantity)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Margin panel */}
          <div className="mt-4 space-y-1 border-t border-gray-100 pt-3 text-sm">
            <Row label="Total bundle cost" value={formatCurrency(totalCost)} />
            {itemsRetail > 0 && (
              <Row label="Items sold separately" value={formatCurrency(itemsRetail)} />
            )}

            <label className="flex items-center justify-between gap-3 py-1">
              <span className="text-gray-500">Bundle selling price</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={draft.sellingPrice}
                onChange={(e) => setDraft((d) => ({ ...d, sellingPrice: e.target.value }))}
                placeholder="0.00"
                className="w-28 rounded-md border border-gray-300 px-2.5 py-1 text-right text-sm outline-none focus:border-gray-900"
              />
            </label>

            <div className="flex items-center justify-between border-t border-gray-100 pt-2 font-semibold">
              <span className="text-gray-900">Net profit</span>
              <span className={profit >= 0 ? "text-emerald-600" : "text-red-600"}>
                {formatCurrency(profit)}
                {price > 0 && (
                  <span className="ml-1 text-xs font-normal text-gray-400">
                    ({margin.toFixed(0)}%)
                  </span>
                )}
              </span>
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending || draft.items.length === 0}
              className="flex-1 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-gray-800 disabled:bg-gray-200 disabled:text-gray-400"
            >
              {isPending ? "Saving…" : draft.id ? "Update Bundle" : "Save Bundle"}
            </button>
            {(draft.id || draft.items.length > 0) && (
              <button
                type="button"
                onClick={() => {
                  setDraft(blankDraft());
                  setError(null);
                }}
                disabled={isPending}
                className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:border-gray-900 disabled:opacity-50"
              >
                Cancel
              </button>
            )}
          </div>
        </section>
      </div>

      {/* Existing bundles */}
      <section className="mt-6">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">
          Saved bundles ({bundles.length})
        </h2>

        {bundles.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-300 px-4 py-10 text-center text-sm text-gray-500">
            No bundles yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {bundles.map((bundle) => {
              const bundleProfit = bundle.price - bundle.cost;
              return (
                <article
                  key={bundle.id}
                  className={`rounded-xl border bg-white p-4 ${
                    bundle.isActive ? "border-gray-200" : "border-gray-200 bg-gray-50/60"
                  }`}
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold text-gray-900">
                        {bundle.name}
                      </h3>
                      <p className="truncate font-mono text-[11px] text-gray-400">{bundle.sku}</p>
                    </div>
                    {!bundle.isActive && (
                      <span className="shrink-0 rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-medium text-gray-600">
                        Inactive
                      </span>
                    )}
                  </div>

                  <ul className="mb-3 space-y-0.5 text-[11px] text-gray-600">
                    {bundle.items.map((item) => (
                      <li key={item.id} className="truncate">
                        {item.quantity}×{" "}
                        {item.itemType === "DECANT" ? `${item.decantSizeMl}ml` : "Bottle"} —{" "}
                        {item.productName}
                      </li>
                    ))}
                  </ul>

                  <dl className="mb-3 space-y-0.5 text-xs">
                    <Row label="Cost" value={formatCurrency(bundle.cost)} />
                    <Row label="Price" value={formatCurrency(bundle.price)} />
                    <div className="flex items-center justify-between font-medium">
                      <dt className="text-gray-500">Profit</dt>
                      <dd className={bundleProfit >= 0 ? "text-emerald-600" : "text-red-600"}>
                        {formatCurrency(bundleProfit)}
                      </dd>
                    </div>
                  </dl>

                  <div className="flex gap-2 text-xs font-medium">
                    <button
                      type="button"
                      onClick={() => loadForEdit(bundle)}
                      className="text-gray-600 transition hover:text-gray-900"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleToggleActive(bundle)}
                      className="text-gray-600 transition hover:text-gray-900 disabled:opacity-50"
                    >
                      {bundle.isActive ? "Deactivate" : "Restore"}
                    </button>
                    {bundle.soldCount === 0 && (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleDelete(bundle)}
                        className="ml-auto text-gray-400 transition hover:text-red-600 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    )}
                    {bundle.soldCount > 0 && (
                      <span className="ml-auto text-[11px] font-normal text-gray-400">
                        {bundle.soldCount} sold
                      </span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}

// ─── Shared bits ─────────────────────────────────────────────────────

const inputClass =
  "w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm outline-none transition focus:border-gray-900";

const stepperClass =
  "flex h-6 w-6 items-center justify-center rounded border border-gray-200 text-sm leading-none transition hover:border-gray-900";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-gray-900">{value}</dd>
    </div>
  );
}
