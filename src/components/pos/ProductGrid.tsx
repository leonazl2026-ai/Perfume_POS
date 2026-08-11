"use client";

import { useEffect, useMemo, useState } from "react";
import { bundleAddableCount, remainingStock, type StockUsage } from "@/lib/cart";
import { formatCurrency, formatMl } from "@/lib/format";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { TranslationKey } from "@/lib/i18n";
import type { CatalogBundle, CatalogVariant, PosCatalog } from "@/types/catalog";

type FilterTab = "ALL" | "BOTTLES" | "DECANTS" | "BUNDLES";
type ViewMode = "GRID" | "LIST";

const TABS: { id: FilterTab; key: TranslationKey }[] = [
  { id: "ALL", key: "common.all" },
  { id: "BOTTLES", key: "pos.fullBottles" },
  { id: "DECANTS", key: "pos.decants" },
  { id: "BUNDLES", key: "pos.bundles" },
];

const VIEW_STORAGE_KEY = "pos.viewMode";

/** Small epsilon so float drift never hides an affordable decant. */
const ML_EPSILON = 1e-6;

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
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<FilterTab>("ALL");
  const [view, setView] = useState<ViewMode>("GRID");

  // Restore the cashier's last view. Read after mount so server and client
  // markup match on the first render.
  useEffect(() => {
    const stored = window.localStorage.getItem(VIEW_STORAGE_KEY);
    if (stored === "GRID" || stored === "LIST") setView(stored);
  }, []);

  const changeView = (next: ViewMode) => {
    setView(next);
    window.localStorage.setItem(VIEW_STORAGE_KEY, next);
  };

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
      <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("pos.search")}
          className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm shadow-sm outline-none transition focus:border-gray-900 focus:ring-1 focus:ring-gray-900 xl:max-w-sm"
        />

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-lg bg-gray-200/70 p-1">
            {TABS.map((tabOption) => (
              <button
                key={tabOption.id}
                type="button"
                onClick={() => setTab(tabOption.id)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  tab === tabOption.id
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                {t(tabOption.key)}
              </button>
            ))}
          </div>

          <div className="flex gap-1 rounded-lg bg-gray-200/70 p-1">
            <ViewButton
              active={view === "GRID"}
              label={t("pos.gridView")}
              onClick={() => changeView("GRID")}
            >
              <GridIcon />
            </ViewButton>
            <ViewButton
              active={view === "LIST"}
              label={t("pos.listView")}
              onClick={() => changeView("LIST")}
            >
              <ListIcon />
            </ViewButton>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {isEmpty ? (
          <p className="rounded-lg border border-dashed border-gray-300 p-10 text-center text-sm text-gray-500">
            {t("pos.noMatch")}
          </p>
        ) : view === "GRID" ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
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
        ) : (
          <ProductList
            bundles={visibleBundles}
            variants={visibleVariants}
            variantsById={variantsById}
            usage={usage}
            showBottle={tab !== "DECANTS"}
            showDecants={tab !== "BOTTLES"}
            onAddFullBottle={onAddFullBottle}
            onAddDecant={onAddDecant}
            onAddBundle={onAddBundle}
          />
        )}
      </div>
    </section>
  );
}

// ─── List view ───────────────────────────────────────────────────────

interface ProductListProps {
  bundles: CatalogBundle[];
  variants: CatalogVariant[];
  variantsById: Map<string, CatalogVariant>;
  usage: Map<string, StockUsage>;
  showBottle: boolean;
  showDecants: boolean;
  onAddFullBottle: (variant: CatalogVariant) => void;
  onAddDecant: (variant: CatalogVariant, sizeMl: number) => void;
  onAddBundle: (bundle: CatalogBundle) => void;
}

/**
 * High-density scanning layout: one row per batch, all decant sizes exposed
 * as inline quick-add buttons so a whole order can be rung up without
 * opening anything.
 */
function ProductList({
  bundles,
  variants,
  variantsById,
  usage,
  showBottle,
  showDecants,
  onAddFullBottle,
  onAddDecant,
  onAddBundle,
}: ProductListProps) {
  const { t } = useI18n();

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <table className="w-full min-w-[44rem] text-sm">
        <thead className="border-b border-gray-100 bg-gray-50 text-left text-[11px] uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-3 py-2 font-medium">{t("pos.brand")}</th>
            <th className="px-3 py-2 font-medium">{t("pos.product")}</th>
            <th className="px-3 py-2 font-medium">{t("pos.batchId")}</th>
            <th className="px-3 py-2 text-right font-medium">{t("common.stock")}</th>
            <th className="px-3 py-2 font-medium">{t("pos.quickAdd")}</th>
          </tr>
        </thead>

        <tbody className="divide-y divide-gray-100">
          {bundles.map((bundle) => {
            const addable = bundleAddableCount(bundle, variantsById, usage);
            return (
              <tr key={bundle.id} className="bg-amber-50/40">
                <td className="px-3 py-2 text-[11px] font-semibold uppercase text-amber-600">
                  Bundle
                </td>
                <td className="px-3 py-2">
                  <span className="block font-medium text-gray-900">{bundle.name}</span>
                  <span className="block text-[11px] text-gray-500">
                    {bundle.constituents
                      .map(
                        (c) =>
                          `${c.quantity}× ${
                            c.itemType === "DECANT" ? `${c.decantSizeMl}ml` : "Bottle"
                          }`
                      )
                      .join(" + ")}
                  </span>
                </td>
                <td className="px-3 py-2 font-mono text-[11px] text-gray-400">{bundle.sku}</td>
                <td className="px-3 py-2 text-right">
                  <span className={addable > 0 ? "text-gray-700" : "text-red-500"}>
                    {addable} set{addable === 1 ? "" : "s"}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    disabled={addable < 1}
                    onClick={() => onAddBundle(bundle)}
                    className="rounded-lg border border-amber-600 bg-amber-600 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-100 disabled:text-gray-400"
                  >
                    Set · {formatCurrency(bundle.price)}
                  </button>
                </td>
              </tr>
            );
          })}

          {variants.map((variant) => {
            const remaining = remainingStock(variant, usage);
            return (
              <tr key={variant.id}>
                <td className="px-3 py-2 text-[11px] uppercase tracking-wide text-gray-400">
                  {variant.brand ?? "—"}
                </td>
                <td className="px-3 py-2">
                  <span className="block font-medium text-gray-900">{variant.productName}</span>
                  <span className="block text-[11px] text-gray-500">
                    {variant.fullBottleSizeMl}ml bottle
                  </span>
                </td>
                <td className="px-3 py-2 font-mono text-[11px] text-gray-400">
                  {variant.variantBatchId}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right text-[11px]">
                  <span className={remaining.bottles > 0 ? "text-gray-700" : "text-red-500"}>
                    {remaining.bottles} {t("pos.sealed")}
                  </span>
                  <span className="text-gray-300"> · </span>
                  <span className={remaining.ml > 0 ? "text-gray-700" : "text-red-500"}>
                    {formatMl(remaining.ml)}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {showBottle && (
                      <button
                        type="button"
                        disabled={remaining.bottles < 1}
                        onClick={() => onAddFullBottle(variant)}
                        className="rounded-lg border border-gray-900 bg-gray-900 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-100 disabled:text-gray-400"
                      >
                        Bottle · {formatCurrency(variant.fullBottlePrice)}
                      </button>
                    )}

                    {showDecants &&
                      variant.decantOptions.map((option) => {
                        const affordable = remaining.ml + ML_EPSILON >= option.sizeMl;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            disabled={!affordable}
                            onClick={() => onAddDecant(variant, option.sizeMl)}
                            title={affordable ? undefined : "Not enough remaining ml"}
                            className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs transition hover:border-gray-900 hover:bg-gray-50 disabled:cursor-not-allowed disabled:border-gray-100 disabled:bg-gray-50 disabled:text-gray-300 disabled:hover:border-gray-100"
                          >
                            <span className="font-semibold">{option.sizeMl}ml</span>
                            <span className="ml-1 text-gray-500">
                              {formatCurrency(option.price)}
                            </span>
                          </button>
                        );
                      })}

                    {!showBottle && variant.decantOptions.length === 0 && (
                      <span className="text-[11px] text-gray-400">No options</span>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Grid view cards ─────────────────────────────────────────────────

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
              const affordable = remaining.ml + ML_EPSILON >= option.sizeMl;
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
                  <span className="text-[11px] text-gray-500">{formatCurrency(option.price)}</span>
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

// ─── View toggle ─────────────────────────────────────────────────────

function ViewButton({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={`flex h-7 w-7 items-center justify-center rounded-md transition ${
        active ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-900"
      }`}
    >
      {children}
    </button>
  );
}

function GridIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <rect x="1" y="1" width="6" height="6" rx="1.5" />
      <rect x="9" y="1" width="6" height="6" rx="1.5" />
      <rect x="1" y="9" width="6" height="6" rx="1.5" />
      <rect x="9" y="9" width="6" height="6" rx="1.5" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <rect x="1" y="2.5" width="14" height="2" rx="1" />
      <rect x="1" y="7" width="14" height="2" rx="1" />
      <rect x="1" y="11.5" width="14" height="2" rx="1" />
    </svg>
  );
}
