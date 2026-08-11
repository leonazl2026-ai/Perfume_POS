import type { NextRequest } from "next/server";
import { csvResponse, fileStamp, toCsv, type CsvValue } from "@/lib/csv";
import { parseDateRange } from "@/lib/dateRange";
import { DELIVERY_LABELS } from "@/lib/delivery";
import {
  getFinancialSummary,
  getSaleLinesForExport,
  getSales,
} from "@/lib/reportQueries";
import { isAuthenticated } from "@/lib/session";
import type { DeliveryStatusValue } from "@/types/reports";

export const dynamic = "force-dynamic";

const DELIVERY_VALUES: DeliveryStatusValue[] = [
  "NOT_REQUIRED",
  "PENDING",
  "PACKED",
  "SHIPPED",
  "DELIVERED",
  "RETURNED",
];

const money = (value: number): string => value.toFixed(2);
const isoDate = (date: Date): string => date.toISOString();

/**
 * CSV export honouring the same filters as the Sales screen.
 * `?mode=lines` exports one row per sale line instead of one per sale.
 */
export async function GET(request: NextRequest) {
  // Middleware already gates /api/export, but this route reads financial
  // data, so it verifies the session itself as well.
  if (!(await isAuthenticated())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const range = parseDateRange(params);

  const deliveryStatus = DELIVERY_VALUES.includes(params.delivery as DeliveryStatusValue)
    ? (params.delivery as DeliveryStatusValue)
    : undefined;

  const filters = {
    range,
    deliveryStatus,
    includeVoided: params.voided === "1",
    query: params.q,
  };

  if (params.mode === "lines") {
    const lines = await getSaleLinesForExport(filters);

    const csv = toCsv(
      [
        "Sale Number",
        "Date",
        "Customer",
        "Status",
        "Line Type",
        "Item",
        "Batch / SKU",
        "Decant Size (ml)",
        "Quantity",
        "Unit Cost",
        "Unit Price",
        "Line Cost",
        "Line Total",
        "Line Profit",
      ],
      lines.map<CsvValue[]>((line) => [
        line.saleNumber,
        isoDate(line.saleDate),
        line.customerName ?? "Walk-in",
        line.status,
        line.lineType,
        line.itemName,
        line.batchId,
        line.decantSizeMl,
        line.quantity,
        money(line.unitCost),
        money(line.unitPrice),
        money(line.lineCost),
        money(line.lineTotal),
        money(line.lineProfit),
      ])
    );

    return csvResponse(csv, `sale-line-items-${fileStamp()}.csv`);
  }

  const [sales, summary] = await Promise.all([
    getSales(filters),
    getFinancialSummary(range),
  ]);

  const rows: CsvValue[][] = sales.map((sale) => [
    sale.saleNumber,
    isoDate(new Date(sale.saleDate)),
    sale.customerName ?? "Walk-in",
    sale.paymentMethod,
    sale.status,
    DELIVERY_LABELS[sale.deliveryStatus],
    sale.courier ?? "",
    sale.trackingNumber ?? "",
    sale.itemCount,
    money(sale.total),
    money(sale.totalCost),
    money(sale.totalProfit),
  ]);

  // Trailing summary block so the file stands alone as a bookkeeping record.
  rows.push([]);
  rows.push(["Period", range.label]);
  rows.push(["Revenue", money(summary.revenue)]);
  rows.push(["Cost of goods", money(summary.cogs)]);
  rows.push(["Gross profit", money(summary.grossProfit)]);
  rows.push(["Operating expenses", money(summary.expenses)]);
  rows.push(["Net profit", money(summary.netProfit)]);

  const csv = toCsv(
    [
      "Sale Number",
      "Date",
      "Customer",
      "Payment",
      "Status",
      "Delivery",
      "Courier",
      "Tracking",
      "Items",
      "Total",
      "Cost",
      "Profit",
    ],
    rows
  );

  return csvResponse(csv, `sales-${fileStamp()}.csv`);
}
