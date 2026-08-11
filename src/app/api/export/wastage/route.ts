import type { NextRequest } from "next/server";
import { csvResponse, fileStamp, toCsv, type CsvValue } from "@/lib/csv";
import { parseDateRange } from "@/lib/dateRange";
import { wastageLabel } from "@/lib/wastage";
import { getWastageLogs, getWastageTotals } from "@/lib/reportQueries";
import { isAuthenticated } from "@/lib/session";

export const dynamic = "force-dynamic";

const money = (value: number): string => value.toFixed(2);

export async function GET(request: NextRequest) {
  if (!(await isAuthenticated())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const range = parseDateRange(params);

  const [logs, totals] = await Promise.all([getWastageLogs(range), getWastageTotals(range)]);

  const rows: CsvValue[][] = logs.map((log) => [
    new Date(log.createdAt).toISOString(),
    log.productName,
    log.variantBatchId,
    log.supplierName ?? "",
    wastageLabel(log.reason),
    log.mlDeducted || "",
    log.bottlesDeducted || "",
    // A voided row is shown at zero so the column still sums to the real loss.
    log.voidedAt ? "0.00" : money(log.lossValue),
    log.voidedAt ? "VOIDED" : "",
    log.note ?? "",
  ]);

  rows.push([]);
  rows.push(["Period", range.label]);
  for (const total of totals) {
    rows.push([
      `Total — ${wastageLabel(total.reason)}`,
      "",
      "",
      "",
      `${total.count} events`,
      total.mlDeducted,
      "",
      money(total.lossValue),
    ]);
  }
  rows.push([
    "Grand total (excludes voided)",
    "",
    "",
    "",
    "",
    "",
    "",
    money(totals.reduce((sum, t) => sum + t.lossValue, 0)),
  ]);

  const csv = toCsv(
    [
      "Date",
      "Product",
      "Batch",
      "Supplier",
      "Reason",
      "ml Deducted",
      "Bottles Deducted",
      "Monetary Loss (Ks)",
      "Voided",
      "Note",
    ],
    rows
  );

  return csvResponse(csv, `wastage-${fileStamp()}.csv`);
}
