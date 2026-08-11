"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setVariantActive } from "@/actions/products";
import { formatCurrency, formatMl } from "@/lib/format";
import { StockDialog } from "@/components/admin/StockDialog";
import { VariantForm } from "@/components/admin/VariantForm";
import { Toast, type ToastMessage } from "@/components/ui/Toast";
import type { AdminProductOption, AdminVariant, SupplierRow } from "@/types/admin";

interface ProductManagerProps {
  variants: AdminVariant[];
  products: AdminProductOption[];
  suppliers: SupplierRow[];
}

export function ProductManager({ variants, products, suppliers }: ProductManagerProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdminVariant | null>(null);
  // Bumped on every open so VariantForm remounts with fresh state.
  const [formKey, setFormKey] = useState(0);
  const [stockTarget, setStockTarget] = useState<AdminVariant | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [isPending, startTransition] = useTransition();

  const search = query.trim().toLowerCase();

  const rows = useMemo(
    () =>
      variants.filter((v) => {
        if (!showInactive && !v.isActive) return false;
        if (!search) return true;
        return (
          v.productName.toLowerCase().includes(search) ||
          (v.brand ?? "").toLowerCase().includes(search) ||
          v.variantBatchId.toLowerCase().includes(search)
        );
      }),
    [variants, search, showInactive]
  );

  const notify = (kind: ToastMessage["kind"], text: string) =>
    setToast({ id: Date.now(), kind, text });

  const afterMutation = (message: string) => {
    notify("success", message);
    router.refresh();
  };

  const toggleActive = (variant: AdminVariant) => {
    startTransition(async () => {
      const result = await setVariantActive({
        variantId: variant.id,
        isActive: !variant.isActive,
      });
      if (!result.ok) {
        notify("error", result.error);
        return;
      }
      afterMutation(variant.isActive ? "Batch deactivated." : "Batch reactivated.");
    });
  };

  return (
    <div>
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Products & Stock</h1>
          <p className="text-sm text-gray-500">
            {variants.length} batch{variants.length === 1 ? "" : "es"} tracked
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setFormKey((k) => k + 1);
            setFormOpen(true);
          }}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800"
        >
          + New Batch
        </button>
      </header>

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search product, brand, or batch ID…"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-gray-900 sm:max-w-xs"
        />
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300"
          />
          Show inactive
        </label>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full min-w-[52rem] text-sm">
          <thead className="border-b border-gray-100 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-2.5 font-medium">Product / Batch</th>
              <th className="px-4 py-2.5 text-right font-medium">Bottle</th>
              <th className="px-4 py-2.5 text-right font-medium">Cost / ml</th>
              <th className="px-4 py-2.5 text-right font-medium">Sealed</th>
              <th className="px-4 py-2.5 text-right font-medium">Active ml</th>
              <th className="px-4 py-2.5 font-medium">Decants</th>
              <th className="px-4 py-2.5 text-right font-medium">Actions</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-400">
                  No batches match your filters.
                </td>
              </tr>
            ) : (
              rows.map((variant) => (
                <tr key={variant.id} className={variant.isActive ? "" : "bg-gray-50/60"}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-gray-900">{variant.productName}</p>
                        <p className="truncate font-mono text-[11px] text-gray-400">
                          {variant.brand ? `${variant.brand} · ` : ""}
                          {variant.variantBatchId}
                        </p>
                      </div>
                      {!variant.isActive && (
                        <span className="shrink-0 rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-medium text-gray-600">
                          Inactive
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="px-4 py-3 text-right">
                    <p className="text-gray-900">{variant.fullBottleSizeMl}ml</p>
                    <p className="text-[11px] text-gray-400">
                      {formatCurrency(variant.fullBottlePrice)}
                    </p>
                  </td>

                  <td className="px-4 py-3 text-right text-gray-600">
                    {formatCurrency(variant.costPerMl)}
                  </td>

                  <td className="px-4 py-3 text-right">
                    <span
                      className={
                        variant.unopenedBottles > 0
                          ? "font-medium text-gray-900"
                          : "text-red-500"
                      }
                    >
                      {variant.unopenedBottles}
                    </span>
                  </td>

                  <td className="px-4 py-3 text-right">
                    <span
                      className={
                        variant.decantActiveRemainingMl > 0
                          ? "font-medium text-gray-900"
                          : "text-red-500"
                      }
                    >
                      {formatMl(variant.decantActiveRemainingMl)}
                    </span>
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {variant.decantOptions.length === 0 ? (
                        <span className="text-[11px] text-gray-400">—</span>
                      ) : (
                        variant.decantOptions.map((o) => (
                          <span
                            key={o.id}
                            title={`Cost ${formatCurrency(o.unitCost)} · Profit ${formatCurrency(
                              o.price - o.unitCost
                            )}`}
                            className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-600"
                          >
                            {o.sizeMl}ml · {formatCurrency(o.price)}
                          </span>
                        ))
                      )}
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2 text-xs font-medium">
                      <button
                        type="button"
                        onClick={() => setStockTarget(variant)}
                        className="text-gray-600 transition hover:text-gray-900"
                      >
                        Stock
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(variant);
                          setFormKey((k) => k + 1);
                          setFormOpen(true);
                        }}
                        className="text-gray-600 transition hover:text-gray-900"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => toggleActive(variant)}
                        className="text-gray-400 transition hover:text-red-600 disabled:opacity-50"
                      >
                        {variant.isActive ? "Deactivate" : "Restore"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <VariantForm
        key={formKey}
        open={formOpen}
        variant={editing}
        products={products}
        suppliers={suppliers}
        onClose={() => setFormOpen(false)}
        onSaved={afterMutation}
      />

      <StockDialog
        variant={stockTarget}
        onClose={() => setStockTarget(null)}
        onDone={afterMutation}
      />

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
