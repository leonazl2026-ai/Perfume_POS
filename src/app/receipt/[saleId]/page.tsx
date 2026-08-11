import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/format";
import { formatDateTime } from "@/lib/dateRange";
import { paymentLabel } from "@/lib/paymentMethods";
import { channelLabel } from "@/lib/channels";
import { DELIVERY_LABELS, isFulfilmentOrder } from "@/lib/delivery";
import { PrintButton } from "@/components/PrintButton";
import type { DeliveryStatusValue } from "@/types/reports";

export const dynamic = "force-dynamic";

const SHOP_NAME = process.env.NEXT_PUBLIC_SHOP_NAME ?? "Perfume & Decant";
const SHOP_CONTACT = process.env.NEXT_PUBLIC_SHOP_CONTACT ?? "";

/**
 * Printable receipt / delivery slip.
 *
 * Deliberately outside /admin: cashiers work unauthenticated on /pos and must
 * be able to print. The URL needs the sale's cuid, which is not guessable.
 */
export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ saleId: string }>;
}) {
  const { saleId } = await params;

  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    include: {
      lineItems: {
        include: {
          productVariant: { include: { product: true, supplier: true } },
          bundle: true,
        },
      },
    },
  });

  if (!sale) notFound();

  const lines = sale.lineItems.map((line) => ({
    id: line.id,
    name:
      line.lineType === "BUNDLE"
        ? line.bundle?.name ?? "Bundle"
        : line.productVariant?.product.name ?? "Item",
    detail:
      line.lineType === "DECANT"
        ? `${line.decantSizeMl}ml decant`
        : line.lineType === "FULL_BOTTLE"
          ? `Full bottle ${line.productVariant?.fullBottleSizeMl ?? ""}ml`
          : "Bundle set",
    batchId: line.productVariant?.variantBatchId ?? null,
    supplierName: line.productVariant?.supplier?.name ?? null,
    quantity: line.quantity,
    unitPrice: Number(line.unitPrice),
    lineTotal: Number(line.lineTotal),
  }));

  // Only an actual fulfilment order prints a delivery slip — a walk-in sale
  // is settled at the counter and has nothing pending.
  const isDelivery = isFulfilmentOrder(sale.deliveryStatus as DeliveryStatusValue);

  return (
    <div className="min-h-screen bg-gray-100 py-6 print:bg-white print:py-0">
      {/* Toolbar is hidden by the print stylesheet below. */}
      <div className="mx-auto mb-4 flex max-w-[80mm] items-center justify-between gap-2 print:hidden">
        <a href="/pos" className="text-xs font-medium text-gray-600 hover:text-gray-900">
          ← Back to POS
        </a>
        <PrintButton />
      </div>

      <article className="mx-auto w-[80mm] bg-white p-4 text-[11px] leading-snug text-black shadow print:w-full print:max-w-none print:p-0 print:shadow-none">
        <header className="mb-3 text-center">
          <h1 className="text-sm font-bold uppercase tracking-wide">{SHOP_NAME}</h1>
          {SHOP_CONTACT && <p className="text-[10px]">{SHOP_CONTACT}</p>}
          <p className="mt-1 font-mono text-[10px]">{sale.saleNumber}</p>
          <p className="text-[10px]">{formatDateTime(sale.saleDate)}</p>
          {sale.status === "VOIDED" && (
            <p className="mt-1 font-bold uppercase">*** VOIDED ***</p>
          )}
        </header>

        <div className="mb-2 border-y border-dashed border-black py-1.5 text-[10px]">
          <Line label="Customer" value={sale.customerName ?? "Walk-in"} />
          {sale.customerPhone && <Line label="Phone" value={sale.customerPhone} />}
          <Line label="Payment" value={paymentLabel(sale.paymentMethod)} />
          <Line label="Channel" value={channelLabel(sale.orderChannel)} />
        </div>

        <table className="w-full">
          <thead>
            <tr className="border-b border-dashed border-black text-left">
              <th className="pb-1 font-semibold">Item</th>
              <th className="pb-1 text-center font-semibold">Qty</th>
              <th className="pb-1 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.id} className="align-top">
                <td className="py-1 pr-1">
                  <span className="block">{line.name}</span>
                  <span className="block text-[9px]">{line.detail}</span>
                  {line.batchId && (
                    <span className="block text-[8px]">
                      Batch: {line.batchId}
                      {line.supplierName && ` | ${line.supplierName}`}
                    </span>
                  )}
                </td>
                <td className="py-1 text-center">{line.quantity}</td>
                <td className="py-1 text-right">{formatCurrency(line.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <dl className="mt-2 border-t border-dashed border-black pt-1.5">
          <Line label="Subtotal" value={formatCurrency(Number(sale.subtotal))} />
          {Number(sale.discount) > 0 && (
            <Line label="Discount" value={`- ${formatCurrency(Number(sale.discount))}`} />
          )}
          {Number(sale.tax) > 0 && (
            <Line label="Tax" value={formatCurrency(Number(sale.tax))} />
          )}
          <div className="mt-1 flex justify-between border-t border-black pt-1 text-xs font-bold">
            <dt>TOTAL</dt>
            <dd>{formatCurrency(Number(sale.total))}</dd>
          </div>
        </dl>

        {isDelivery && (
          <section className="mt-3 border-t border-dashed border-black pt-2">
            <h2 className="mb-1 text-[10px] font-bold uppercase">Delivery slip</h2>
            <Line
              label="Status"
              value={DELIVERY_LABELS[sale.deliveryStatus as DeliveryStatusValue]}
            />
            {sale.courier && <Line label="Courier" value={sale.courier} />}
            {sale.trackingNumber && <Line label="Waybill" value={sale.trackingNumber} />}
            {sale.deliveryAddress && (
              <p className="mt-1 whitespace-pre-line text-[10px]">{sale.deliveryAddress}</p>
            )}
          </section>
        )}

        <footer className="mt-3 border-t border-dashed border-black pt-2 text-center text-[10px]">
          <p>Thank you!</p>
        </footer>
      </article>

      {/* Roll-printer friendly: no margins, nothing but the slip. */}
      <style>{`
        @media print {
          @page { margin: 4mm; size: auto; }
          body { background: #fff; }
        }
      `}</style>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="shrink-0">{label}</dt>
      <dd className="truncate text-right">{value}</dd>
    </div>
  );
}
