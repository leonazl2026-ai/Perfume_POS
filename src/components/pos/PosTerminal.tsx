"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { checkoutAction } from "@/actions/sales";
import { logout } from "@/actions/auth";
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
import { DEFAULT_PAYMENT_METHOD } from "@/lib/paymentMethods";
import { DEFAULT_ORDER_CHANNEL } from "@/lib/channels";
import { maxRedeemablePoints, resolveRedemption } from "@/lib/loyalty";
import { useI18n } from "@/components/i18n/I18nProvider";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import type { LoyaltyConfig } from "@/lib/settings";
import type { CatalogBundle, CatalogVariant, PosCatalog } from "@/types/catalog";
import type { CustomerSuggestion } from "@/types/crm";

interface LastSale {
  id: string;
  saleNumber: string;
  pointsEarned: number;
  pointsRedeemed: number;
  pointsBalance: number | null;
}

const EMPTY_META: CheckoutMeta = {
  customerName: "",
  customerPhone: "",
  paymentMethod: DEFAULT_PAYMENT_METHOD,
  orderChannel: DEFAULT_ORDER_CHANNEL,
  discount: 0,
  tax: 0,
  redeemPoints: 0,
  notes: "",
  isDelivery: false,
  deliveryAddress: "",
  courier: "",
  trackingNumber: "",
};

export function PosTerminal({
  catalog,
  loyalty,
  userName,
  canViewProfit,
}: {
  catalog: PosCatalog;
  loyalty: LoyaltyConfig;
  userName: string;
  canViewProfit: boolean;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const [cart, setCart] = useState<CartLine[]>([]);
  const [meta, setMeta] = useState<CheckoutMeta>(EMPTY_META);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [lastSale, setLastSale] = useState<LastSale | null>(null);
  const [isSubmitting, startTransition] = useTransition();
  /** The CRM record attached to this sale, if the cashier matched one. */
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerSuggestion | null>(null);

  const variantsById = useMemo(
    () => new Map(catalog.variants.map((v) => [v.id, v])),
    [catalog.variants]
  );

  // Recomputed on every cart change so the grid can disable anything that
  // would oversell the batch before the server has to reject it.
  const usage = useMemo(() => computeStockUsage(cart, catalog), [cart, catalog]);

  const merchandiseValue = useMemo(
    () => computeTotals(cart, meta.discount, meta.tax).merchandiseValue,
    [cart, meta.discount, meta.tax]
  );

  // Ceiling on redemption: never more than the balance, never more than the
  // order is worth. Mirrors the server-side clamp in createSale.
  const maxRedeemable = useMemo(
    () =>
      selectedCustomer
        ? maxRedeemablePoints(selectedCustomer.points, merchandiseValue, loyalty)
        : 0,
    [selectedCustomer, merchandiseValue, loyalty]
  );

  const appliedRedemption = useMemo(
    () =>
      selectedCustomer
        ? resolveRedemption(
            meta.redeemPoints,
            selectedCustomer.points,
            merchandiseValue,
            loyalty
          )
        : { points: 0, discount: 0 },
    [selectedCustomer, meta.redeemPoints, merchandiseValue, loyalty]
  );

  const totals = useMemo(
    () => computeTotals(cart, meta.discount, meta.tax, appliedRedemption.discount),
    [cart, meta.discount, meta.tax, appliedRedemption.discount]
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
    setSelectedCustomer(null);
  }, []);

  const canIncrementLine = useCallback(
    (line: CartLine) => canIncrement(line, catalog, variantsById, usage),
    [catalog, variantsById, usage]
  );

  /**
   * Fills the customer block from a CRM match, without clobbering an address
   * the cashier already typed. It deliberately does NOT tick "Delivery order":
   * a stored address is a convenience, not a statement that this particular
   * sale ships — that stays the cashier's explicit choice.
   */
  const handlePickCustomer = useCallback((customer: CustomerSuggestion) => {
    setSelectedCustomer(customer);
    setMeta((current) => ({
      ...current,
      customerName: customer.name ?? current.customerName,
      customerPhone: customer.phone ?? current.customerPhone,
      orderChannel: customer.channel,
      deliveryAddress: current.deliveryAddress || customer.address || "",
      // A fresh customer starts with no redemption staged.
      redeemPoints: 0,
    }));
  }, []);

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
        orderChannel: meta.orderChannel,
        redeemPoints: appliedRedemption.points,
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
      // Surfaced above the cart so the cashier can print before the next sale.
      setLastSale({
        id: result.data.saleId,
        saleNumber: result.data.saleNumber,
        pointsEarned: result.data.pointsEarned,
        pointsRedeemed: result.data.pointsRedeemed,
        pointsBalance: result.data.pointsBalance,
      });
      setCart([]);
      setMeta(EMPTY_META);
      setSelectedCustomer(null);
      // Pull down the post-sale stock levels the server just wrote.
      router.refresh();
    });
  }, [cart, meta, notify, router]);

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      <header className="flex items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold text-gray-900">{t("pos.title")}</h1>
          <p className="truncate text-xs text-gray-500">
            {userName} · {catalog.variants.length} batches · {catalog.bundles.length} bundles
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <LanguageSwitcher compact />
          <a
            href="/admin"
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:border-gray-900 hover:text-gray-900"
          >
            {t("pos.admin")}
          </a>
          <form action={logout}>
            <button
              type="submit"
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:border-gray-900 hover:text-gray-900"
            >
              {t("nav.signOut")}
            </button>
          </form>
        </div>
      </header>

      {/* Cart takes ~36% but never drops below 400px, so customer inputs,
          channel selectors and totals all have room to breathe. */}
      <main className="grid min-h-0 flex-1 grid-cols-1 gap-4 p-4 lg:grid-cols-[1fr_minmax(400px,36%)] 2xl:grid-cols-[1fr_minmax(440px,32%)]">
        <ProductGrid
          catalog={catalog}
          variantsById={variantsById}
          usage={usage}
          onAddFullBottle={handleAddFullBottle}
          onAddDecant={handleAddDecant}
          onAddBundle={handleAddBundle}
        />

        <div className="flex min-h-0 flex-col gap-2">
          {lastSale && (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
              <span className="min-w-0 truncate text-xs text-emerald-800">
                {t("pos.lastSale")} {lastSale.saleNumber}
                {lastSale.pointsRedeemed > 0 && ` · −${lastSale.pointsRedeemed} pts`}
                {lastSale.pointsEarned > 0 && ` · +${lastSale.pointsEarned} pts`}
                {lastSale.pointsBalance !== null && ` · balance ${lastSale.pointsBalance}`}
              </span>
              <div className="flex shrink-0 items-center gap-2">
                <a
                  href={`/receipt/${lastSale.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-emerald-700"
                >
                  {t("pos.printReceipt")}
                </a>
                <button
                  type="button"
                  onClick={() => setLastSale(null)}
                  aria-label="Dismiss"
                  className="text-emerald-700 transition hover:text-emerald-900"
                >
                  ×
                </button>
              </div>
            </div>
          )}

          <CartSidebar
            cart={cart}
            totals={totals}
            meta={meta}
            isSubmitting={isSubmitting}
            canViewProfit={canViewProfit}
            loyalty={loyalty}
            selectedCustomer={selectedCustomer}
            maxRedeemable={maxRedeemable}
            canIncrementLine={canIncrementLine}
            onMetaChange={(patch) => setMeta((m) => ({ ...m, ...patch }))}
            onPickCustomer={handlePickCustomer}
            onSetQuantity={handleSetQuantity}
            onRemove={handleRemove}
            onClear={handleClear}
            onCheckout={handleCheckout}
          />
        </div>
      </main>

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
