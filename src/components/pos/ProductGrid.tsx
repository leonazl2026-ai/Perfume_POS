"use client";

import { useMemo, useState } from "react";
import { bundleAddableCount, remainingStock, type StockUsage } from "@/lib/cart";
import { formatCurrency, formatMl } from "@/lib/format";
import type { CatalogBundle, CatalogVariant, PosCatalog } from "@/types/catalog";

type FilterTab = "ALL" | "BOTTLES" | "DECANTS" | "BUNDLES";

const TABS: { id: FilterTab; label: string }[] = [
  { id: "ALL", label: "All" },
  { id: "BOTTLES", label: "Full Bottles" },
  { id: "DECANTS", label: "Decants" },
  { id: "BUNDLES", label: "Bundles" },
];

interface ProductGridProps {
  catalog: PosCatalog;
  variantsById: Map<string, CatalogVariant>;
  usage: Map<string, StockUsage>;
  onAddFullBottle: (variant: CatalogVariant) => void;
  onAddDecant: (variant: CatalogVariant, sizeMl: number) => void;
  onAddBundle: (bundle: CatalogBundle) => void;
}

export function ProductGrid({
  catalog,
  variantsById,
  usage,
  onAddFullBottle,
  onAddDecant,
  onAddBundle,
}: ProductGridProps) {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<FilterTab>("ALL");

  const search = query.trim().toLowerCase();

  const visibleVariants = useMemo(() => {
    if (tab === "BUNDLES") return [];
    return catalog.variants.filter((v) => {
      if (!search) return true;
      return (
        v.productName.toLowerCase().includes(search) ||
        (v.brand ?? "").toLowerCase().includes(search) ||
        v.variantBatchId.toLowerCase().includes(search)
      );
    });
  }, [catalog.variants, search, tab]);

  const visibleBundles = useMemo(() => {
    if (tab === "BOTTLES" || tab === "DECANTS") return [];
    return catalog.bundles.filter((b) => {
      if (!search) return true;
      return b.name.toLowerCase().includes(search) || b.sku.toLowerCase().includes(search);
    });
  }, [catalog.bundles, search, tab]);

  const isEmpty = visibleVariants.length === 0 && visibleBundles.length === 0;

  return (
    <section className="flex min-h-0 flex-col">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by product, brand, or batch ID…"
          className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm shadow-sm outline-none transition focus:border-gray-900 focus:ring-1 focus:ring-gray-900 sm:max-w-sm"
        />

        <div className="flex gap-1 rounded-lg bg-gray-200/70 p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                tab === t.id
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {isEmpty ? (
          <p className="rounded-lg border border-dashed border-gray-300 p-10 text-center text-sm text-gray-500">
            No products match your search.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {visibleBundles.map((bundle) => (
              <BundleCard
                key={bundle.id}
                bundle={bundle}
                addable={bundleAddableCount(bundle, variantsById, usage)}
                onAdd={() => onAddBundle(bundle)}
              />
            ))}

            {visibleVariants.map((variant) => (
              <VariantCard
                key={variant.id}
                variant={variant}
                remaining={remainingStock(variant, usage)}
                showBottle={tab !== "DECANTS"}
                showDecants={tab !== "BOTTLES"}
                onAddFullBottle={() => onAddFullBottle(variant)}
                onAddDecant={(size) => onAddDecant(variant, size)}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// ─── Cards ───────────────────────────────────────────────────────────

interface VariantCardProps {
  variant: CatalogVariant;
  remaining: StockUsage;
  showBottle: boolean;
  showDecants: boolean;
  onAddFullBottle: () => void;
  onAddDecant: (sizeMl: number) => void;
}

function VariantCard({
  variant,
  remaining,
  showBottle,
  showDecants,
  onAddFullBottle,
  onAddDecant,
}: VariantCardProps) {
  const decantOptions = showDecants ? variant.decantOptions : [];

  return (
    <article className="flex flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-gray-300 hover:shadow">
      <header className="mb-3">
        {variant.brand && (
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            {variant.brand}
          </p>
        )}
        <h3 className="truncate text-sm font-semibold text-gray-900" title={variant.productName}>
          {variant.productName}
        </h3>
        <p className="mt-0.5 font-mono text-[11px] text-gray-400">{variant.variantBatchId}</p>
      </header>

      <div className="mb-3 flex flex-wrap gap-1.5 text-[11px]">
        <StockPill
          label={`${remaining.bottles} sealed`}
          tone={remaining.bottles > 0 ? "neutral" : "empty"}
        />
        <StockPill
          label={`${formatMl(remaining.ml)} open`}
          tone={remaining.ml > 0 ? "neutral" : "empty"}
        />
      </div>

      <div className="mt-auto flex flex-col gap-2">
        {showBottle && (
          <button
            type="button"
            disabled={remaining.bottles < 1}
            onClick={onAddFullBottle}
            className="flex w-full items-center justify-between rounded-lg border border-gray-900 bg-gray-900 px-3 py-2 text-xs font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-100 disabled:text-gray-400"
          >
            <span>Full Bottle · {variant.fullBottleSizeMl}ml</span>
            <span className="font-semibold">{formatCurrency(variant.fullBottlePrice)}</span>
          </button>
        )}

        {decantOptions.length > 0 && (
          <div className="grid grid-cols-2 gap-1.5">
            {decantOptions.map((option) => {
              const affordable = remaining.ml + 1e-6 >= option.sizeMl;
              return (
                <button
                  key={option.id}
                  type="button"
                  disabled={!affordable}
                  onClick={() => onAddDecant(option.sizeMl)}
                  title={affordable ? undefined : "Not enough remaining ml"}
                  className="flex flex-col items-start rounded-lg border border-gray-200 px-2.5 py-1.5 text-left transition hover:border-gray-900 hover:bg-gray-50 disabled:cursor-not-allowed disabled:border-gray-100 disabled:bg-gray-50 disabled:text-gray-300 disabled:hover:border-gray-100"
                >
                  <span className="text-xs font-semibold">{option.sizeMl}ml</span>
                  <span className="text-[11px] text-gray-500">
                    {formatCurrency(option.price)}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </article>
  );
}

interface BundleCardProps {
  bundle: CatalogBundle;
  addable: number;
  onAdd: () => void;
}

function BundleCard({ bundle, addable, onAdd }: BundleCardProps) {
  return (
    <article className="flex flex-col rounded-xl border border-amber-200 bg-amber-50/50 p-4 shadow-sm transition hover:border-amber-300 hover:shadow">
      <header className="mb-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-600">Bundle</p>
        <h3 className="truncate text-sm font-semibold text-gray-900" title={bundle.name}>
          {bundle.name}
        </h3>
        <p className="mt-0.5 font-mono text-[11px] text-gray-400">{bundle.sku}</p>
      </header>

      <ul className="mb-3 space-y-0.5 text-[11px] text-gray-600">
        {bundle.constituents.map((c, i) => (
          <li key={`${c.productVariantId}-${i}`} className="truncate">
            {c.quantity}× {c.itemType === "DECANT" ? `${c.decantSizeMl}ml` : "Bottle"} —{" "}
            {c.productName}
          </li>
        ))}
      </ul>

      <div className="mt-auto">
        <p className="mb-2 text-[11px] text-gray-500">
          {addable > 0 ? `${addable} set${addable === 1 ? "" : "s"} buildable` : "Out of stock"}
        </p>
        <button
          type="button"
          disabled={addable < 1}
          onClick={onAdd}
          className="flex w-full items-center justify-between rounded-lg border border-amber-600 bg-amber-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-100 disabled:text-gray-400"
        >
          <span>Add Set</span>
          <span className="font-semibold">{formatCurrency(bundle.price)}</span>
        </button>
      </div>
    </article>
  );
}

function StockPill({ label, tone }: { label: string; tone: "neutral" | "empty" }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 font-medium ${
        tone === "empty" ? "bg-red-50 text-red-500" : "bg-gray-100 text-gray-600"
      }`}
    >
      {label}
    </span>
  );
}
