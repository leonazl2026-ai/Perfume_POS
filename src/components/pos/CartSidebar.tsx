"use client";

import { formatCurrency } from "@/lib/format";
import { PAYMENT_METHODS, paymentLabel } from "@/lib/paymentMethods";
import { CHANNEL_LABELS, ORDER_CHANNELS, type OrderChannelValue } from "@/lib/channels";
import { CustomerLookup } from "@/components/pos/CustomerLookup";
import { pointsToValue } from "@/lib/loyalty";
import type { LoyaltyConfig } from "@/lib/settings";
import type { CartLine, CartTotals } from "@/lib/cart";
import type { CustomerSuggestion } from "@/types/crm";

export interface CheckoutMeta {
  customerName: string;
  customerPhone: string;
  paymentMethod: string;
  orderChannel: OrderChannelValue;
  discount: number;
  tax: number;
  redeemPoints: number;
  notes: string;
  isDelivery: boolean;
  deliveryAddress: string;
  courier: string;
  trackingNumber: string;
}

interface CartSidebarProps {
  cart: CartLine[];
  totals: CartTotals;
  meta: CheckoutMeta;
  isSubmitting: boolean;
  loyalty: LoyaltyConfig;
  selectedCustomer: CustomerSuggestion | null;
  maxRedeemable: number;
  canIncrementLine: (line: CartLine) => boolean;
  onMetaChange: (patch: Partial<CheckoutMeta>) => void;
  onPickCustomer: (customer: CustomerSuggestion) => void;
  onSetQuantity: (key: string, quantity: number) => void;
  onRemove: (key: string) => void;
  onClear: () => void;
  onCheckout: () => void;
}

export function CartSidebar({
  cart,
  totals,
  meta,
  isSubmitting,
  loyalty,
  selectedCustomer,
  maxRedeemable,
  canIncrementLine,
  onMetaChange,
  onPickCustomer,
  onSetQuantity,
  onRemove,
  onClear,
  onCheckout,
}: CartSidebarProps) {
  const isEmpty = cart.length === 0;
  const showLoyalty = loyalty.enabled && selectedCustomer !== null;

  return (
    <aside className="flex h-full min-h-0 flex-col rounded-xl border border-gray-200 bg-white shadow-sm">
      <header className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-900">
          Cart{" "}
          {totals.itemCount > 0 && (
            <span className="ml-1 rounded-full bg-gray-900 px-2 py-0.5 text-[11px] text-white">
              {totals.itemCount}
            </span>
          )}
        </h2>
        {!isEmpty && (
          <button
            type="button"
            onClick={onClear}
            disabled={isSubmitting}
            className="text-xs font-medium text-gray-500 transition hover:text-red-600 disabled:opacity-50"
          >
            Clear
          </button>
        )}
      </header>

      {/* Line items */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {isEmpty ? (
          <p className="px-4 py-10 text-center text-sm text-gray-400">
            Select products to start a sale.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {cart.map((line) => (
              <li key={line.key} className="flex gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900">{line.label}</p>
                  <p className="truncate text-[11px] text-gray-500">{line.sublabel}</p>

                  <div className="mt-2 flex items-center gap-2">
                    <QuantityStepper
                      quantity={line.quantity}
                      disabled={isSubmitting}
                      canIncrement={canIncrementLine(line)}
                      onChange={(q) => onSetQuantity(line.key, q)}
                    />
                    <button
                      type="button"
                      onClick={() => onRemove(line.key)}
                      disabled={isSubmitting}
                      className="text-[11px] text-gray-400 transition hover:text-red-600 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900">
                    {formatCurrency(line.unitPrice * line.quantity)}
                  </p>
                  <p className="text-[11px] text-gray-400">{formatCurrency(line.unitPrice)} ea</p>
                  <p className="mt-1 text-[11px] font-medium text-emerald-600">
                    +{formatCurrency((line.unitPrice - line.unitCost) * line.quantity)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Checkout panel */}
      <div className="border-t border-gray-100 px-4 py-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="col-span-2">
            <CustomerLookup
              label="Customer"
              value={meta.customerName}
              placeholder="Walk-in"
              disabled={isSubmitting}
              onChange={(value) => onMetaChange({ customerName: value })}
              onPick={onPickCustomer}
            />
          </div>

          <div className="col-span-2">
            <CustomerLookup
              label="Phone"
              type="tel"
              value={meta.customerPhone}
              placeholder="09xxxxxxxxx — matches repeat buyers"
              disabled={isSubmitting}
              onChange={(value) => onMetaChange({ customerPhone: value })}
              onPick={onPickCustomer}
            />
          </div>

          <label className="col-span-2 block">
            <span className="mb-1 block text-[11px] font-medium text-gray-500">
              Order source / channel
            </span>
            <select
              value={meta.orderChannel}
              onChange={(e) =>
                onMetaChange({ orderChannel: e.target.value as OrderChannelValue })
              }
              disabled={isSubmitting}
              className="w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-gray-900 disabled:bg-gray-50"
            >
              {ORDER_CHANNELS.map((channel) => (
                <option key={channel} value={channel}>
                  {CHANNEL_LABELS[channel]}
                </option>
              ))}
            </select>
          </label>

          <label className="col-span-2 block">
            <span className="mb-1 block text-[11px] font-medium text-gray-500">Payment</span>
            <select
              value={meta.paymentMethod}
              onChange={(e) => onMetaChange({ paymentMethod: e.target.value })}
              disabled={isSubmitting}
              className="w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-gray-900 disabled:bg-gray-50"
            >
              {PAYMENT_METHODS.map((method) => (
                <option key={method} value={method}>
                  {paymentLabel(method)}
                </option>
              ))}
            </select>
          </label>

          <NumberField
            label="Discount"
            value={meta.discount}
            disabled={isSubmitting}
            onChange={(v) => onMetaChange({ discount: v })}
          />
          <NumberField
            label="Tax"
            value={meta.tax}
            disabled={isSubmitting}
            onChange={(v) => onMetaChange({ tax: v })}
          />
        </div>

        {/* Loyalty — only once a CRM customer is attached to the sale. */}
        {showLoyalty && selectedCustomer && (
          <div className="mt-2 rounded-md border border-amber-200 bg-amber-50/60 px-2.5 py-2">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs font-medium text-amber-800">Loyalty points</span>
              <span className="text-xs text-amber-700">
                {selectedCustomer.points} pts ·{" "}
                {formatCurrency(pointsToValue(selectedCustomer.points, loyalty))}
              </span>
            </div>

            {maxRedeemable > 0 ? (
              <div className="mt-2 flex items-end gap-2">
                <label className="block flex-1">
                  <span className="mb-1 block text-[11px] font-medium text-amber-800">
                    Redeem points
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={maxRedeemable}
                    step={1}
                    value={meta.redeemPoints === 0 ? "" : meta.redeemPoints}
                    placeholder="0"
                    disabled={isSubmitting}
                    onChange={(e) => {
                      const parsed = Math.floor(Number.parseFloat(e.target.value));
                      // Clamped here as well as on the server, so the preview
                      // never shows a discount the sale will not honour.
                      const next =
                        Number.isFinite(parsed) && parsed > 0
                          ? Math.min(parsed, maxRedeemable)
                          : 0;
                      onMetaChange({ redeemPoints: next });
                    }}
                    className="w-full rounded-md border border-amber-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-amber-600 disabled:bg-gray-50"
                  />
                </label>

                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => onMetaChange({ redeemPoints: maxRedeemable })}
                  className="rounded-md border border-amber-600 px-2.5 py-1.5 text-xs font-medium text-amber-800 transition hover:bg-amber-600 hover:text-white disabled:opacity-50"
                >
                  Max ({maxRedeemable})
                </button>

                {meta.redeemPoints > 0 && (
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => onMetaChange({ redeemPoints: 0 })}
                    className="pb-1.5 text-xs font-medium text-amber-700 transition hover:text-amber-900 disabled:opacity-50"
                  >
                    Clear
                  </button>
                )}
              </div>
            ) : (
              <p className="mt-1 text-[11px] text-amber-700">
                {selectedCustomer.points === 0
                  ? "No points to redeem yet."
                  : "Add items to the cart to redeem points."}
              </p>
            )}
          </div>
        )}

        {/* Delivery — collapsed until needed so walk-in checkout stays fast. */}
        <div className="mt-2 rounded-md border border-gray-200 px-2.5 py-2">
          <label className="flex items-center gap-2 text-xs font-medium text-gray-700">
            <input
              type="checkbox"
              checked={meta.isDelivery}
              onChange={(e) => onMetaChange({ isDelivery: e.target.checked })}
              disabled={isSubmitting}
              className="h-3.5 w-3.5 rounded border-gray-300"
            />
            Delivery order
          </label>

          {meta.isDelivery && (
            <div className="mt-2 space-y-2">
              <textarea
                value={meta.deliveryAddress}
                onChange={(e) => onMetaChange({ deliveryAddress: e.target.value })}
                rows={2}
                placeholder="Delivery address"
                disabled={isSubmitting}
                className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm outline-none focus:border-gray-900 disabled:bg-gray-50"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={meta.courier}
                  onChange={(e) => onMetaChange({ courier: e.target.value })}
                  placeholder="Courier"
                  disabled={isSubmitting}
                  className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm outline-none focus:border-gray-900 disabled:bg-gray-50"
                />
                <input
                  value={meta.trackingNumber}
                  onChange={(e) => onMetaChange({ trackingNumber: e.target.value })}
                  placeholder="Waybill no."
                  disabled={isSubmitting}
                  className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 font-mono text-sm outline-none focus:border-gray-900 disabled:bg-gray-50"
                />
              </div>
              <p className="text-[11px] text-gray-400">
                Saved as Pending — track it from Admin → Sales.
              </p>
            </div>
          )}
        </div>

        <dl className="mt-3 space-y-1 border-t border-gray-100 pt-3 text-sm">
          <Row label="Subtotal" value={formatCurrency(totals.subtotal)} />
          {meta.discount > 0 && (
            <Row label="Discount" value={`− ${formatCurrency(meta.discount)}`} />
          )}
          {totals.loyaltyDiscount > 0 && (
            <Row
              label={`Points (${meta.redeemPoints})`}
              value={`− ${formatCurrency(totals.loyaltyDiscount)}`}
              valueClass="text-amber-700"
            />
          )}
          {meta.tax > 0 && <Row label="Tax" value={formatCurrency(meta.tax)} />}
          <Row
            label="Est. Net Profit"
            value={formatCurrency(totals.profit)}
            valueClass="text-emerald-600 font-medium"
          />
          <div className="flex items-center justify-between pt-1 text-base font-semibold text-gray-900">
            <dt>Total</dt>
            <dd>{formatCurrency(totals.total)}</dd>
          </div>
        </dl>

        <button
          type="button"
          onClick={onCheckout}
          disabled={isEmpty || isSubmitting}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
        >
          {isSubmitting && (
            <span
              aria-hidden="true"
              className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
            />
          )}
          {isSubmitting ? "Processing…" : "Complete Sale"}
        </button>
      </div>
    </aside>
  );
}

// ─── Small pieces ────────────────────────────────────────────────────

function QuantityStepper({
  quantity,
  canIncrement,
  disabled,
  onChange,
}: {
  quantity: number;
  canIncrement: boolean;
  disabled: boolean;
  onChange: (quantity: number) => void;
}) {
  const btn =
    "flex h-6 w-6 items-center justify-center rounded border border-gray-200 text-sm leading-none transition hover:border-gray-900 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-gray-200";

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        aria-label="Decrease quantity"
        className={btn}
        disabled={disabled}
        onClick={() => onChange(quantity - 1)}
      >
        −
      </button>
      <span className="w-6 text-center text-sm font-medium tabular-nums">{quantity}</span>
      <button
        type="button"
        aria-label="Increase quantity"
        className={btn}
        disabled={disabled || !canIncrement}
        title={canIncrement ? undefined : "No more stock available"}
        onClick={() => onChange(quantity + 1)}
      >
        +
      </button>
    </div>
  );
}

function NumberField({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium text-gray-500">{label}</span>
      <input
        type="number"
        min={0}
        step="1"
        value={value === 0 ? "" : value}
        placeholder="0"
        disabled={disabled}
        onChange={(e) => {
          const parsed = Number.parseFloat(e.target.value);
          onChange(Number.isFinite(parsed) && parsed > 0 ? parsed : 0);
        }}
        className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm outline-none focus:border-gray-900 disabled:bg-gray-50"
      />
    </label>
  );
}

function Row({
  label,
  value,
  valueClass = "text-gray-900",
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between text-gray-500">
      <dt>{label}</dt>
      <dd className={valueClass}>{value}</dd>
    </div>
  );
}
