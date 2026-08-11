"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { checkoutAction } from "@/actions/sales";
import {
  bundleLine,
  canIncrement,
  computeStockUsage,
  computeTotals,
  decantLine,
  fullBottleLine,
  toSaleLineInputs,
  type CartLine,
} from "@/lib/cart";
import { formatCurrency } from "@/lib/format";
import { CartSidebar, type CheckoutMeta } from "@/components/pos/CartSidebar";
import { ProductGrid } from "@/components/pos/ProductGrid";
import { Toast, type ToastMessage } from "@/components/ui/Toast";
import type { CatalogBundle, CatalogVariant, PosCatalog } from "@/types/catalog";

const EMPTY_META: CheckoutMeta = {
  customerName: "",
  customerPhone: "",
  paymentMethod: "CASH",
  discount: 0,
  tax: 0,
  notes: "",
  isDelivery: false,
  deliveryAddress: "",
  courier: "",
  trackingNumber: "",
};

export function PosTerminal({ catalog }: { catalog: PosCatalog }) {
  const router = useRouter();
  const [cart, setCart] = useState<CartLine[]>([]);
  const [meta, setMeta] = useState<CheckoutMeta>(EMPTY_META);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [isSubmitting, startTransition] = useTransition();

  const variantsById = useMemo(
    () => new Map(catalog.variants.map((v) => [v.id, v])),
    [catalog.variants]
  );

  // Recomputed on every cart change so the grid can disable anything that
  // would oversell the batch before the server has to reject it.
  const usage = useMemo(() => computeStockUsage(cart, catalog), [cart, catalog]);
  const totals = useMemo(
    () => computeTotals(cart, meta.discount, meta.tax),
    [cart, meta.discount, meta.tax]
  );

  const notify = useCallback((kind: ToastMessage["kind"], text: string) => {
    setToast({ id: Date.now(), kind, text });
  }, []);

  /** Merges into an existing line when the same item is added twice. */
  const addLine = useCallback((line: CartLine) => {
    setCart((current) => {
      const existing = current.find((l) => l.key === line.key);
      if (!existing) return [...current, line];
      return current.map((l) => (l.key === line.key ? { ...l, quantity: l.quantity + 1 } : l));
    });
  }, []);

  const handleAddFullBottle = useCallback(
    (variant: CatalogVariant) => addLine(fullBottleLine(variant)),
    [addLine]
  );

  const handleAddDecant = useCallback(
    (variant: CatalogVariant, sizeMl: number) => {
      const line = decantLine(variant, sizeMl);
      if (!line) {
        notify("error", `No ${sizeMl}ml option configured for ${variant.variantBatchId}`);
        return;
      }
      addLine(line);
    },
    [addLine, notify]
  );

  const handleAddBundle = useCallback(
    (bundle: CatalogBundle) => addLine(bundleLine(bundle)),
    [addLine]
  );

  const handleSetQuantity = useCallback((key: string, quantity: number) => {
    setCart((current) =>
      quantity < 1
        ? current.filter((l) => l.key !== key)
        : current.map((l) => (l.key === key ? { ...l, quantity } : l))
    );
  }, []);

  const handleRemove = useCallback((key: string) => {
    setCart((current) => current.filter((l) => l.key !== key));
  }, []);

  const handleClear = useCallback(() => {
    setCart([]);
    setMeta(EMPTY_META);
  }, []);

  const canIncrementLine = useCallback(
    (line: CartLine) => canIncrement(line, catalog, variantsById, usage),
    [catalog, variantsById, usage]
  );

  const handleCheckout = useCallback(() => {
    if (cart.length === 0) return;

    startTransition(async () => {
      const result = await checkoutAction({
        customerName: meta.customerName.trim() || undefined,
        customerPhone: meta.customerPhone.trim() || undefined,
        paymentMethod: meta.paymentMethod,
        discount: meta.discount,
        tax: meta.tax,
        notes: meta.notes.trim() || undefined,
        isDelivery: meta.isDelivery,
        deliveryAddress: meta.deliveryAddress.trim() || undefined,
        courier: meta.courier.trim() || undefined,
        trackingNumber: meta.trackingNumber.trim() || undefined,
        lineItems: toSaleLineInputs(cart),
      });

      if (!result.ok) {
        notify("error", result.error);
        return;
      }

      notify(
        "success",
        `${result.data.saleNumber} · ${formatCurrency(result.data.total)} — profit ${formatCurrency(
          result.data.totalProfit
        )}`
      );
      setCart([]);
      setMeta(EMPTY_META);
      // Pull down the post-sale stock levels the server just wrote.
      router.refresh();
    });
  }, [cart, meta, notify, router]);

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Perfume & Decant POS</h1>
          <p className="text-xs text-gray-500">
            {catalog.variants.length} batches · {catalog.bundles.length} bundles
          </p>
        </div>
        <a
          href="/admin"
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:border-gray-900 hover:text-gray-900"
        >
          Admin
        </a>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-1 gap-4 p-4 lg:grid-cols-[1fr_380px]">
        <ProductGrid
          catalog={catalog}
          variantsById={variantsById}
          usage={usage}
          onAddFullBottle={handleAddFullBottle}
          onAddDecant={handleAddDecant}
          onAddBundle={handleAddBundle}
        />

        <CartSidebar
          cart={cart}
          totals={totals}
          meta={meta}
          isSubmitting={isSubmitting}
          canIncrementLine={canIncrementLine}
          onMetaChange={(patch) => setMeta((m) => ({ ...m, ...patch }))}
          onSetQuantity={handleSetQuantity}
          onRemove={handleRemove}
          onClear={handleClear}
          onCheckout={handleCheckout}
        />
      </main>

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
