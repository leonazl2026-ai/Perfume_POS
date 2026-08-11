import { SalesReport } from "@/components/admin/SalesReport";
import { parseDateRange } from "@/lib/dateRange";
import {
  getCustomerBreakdown,
  getDeliveryCounts,
  getFinancialSummary,
  getSales,
} from "@/lib/reportQueries";
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

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function AdminSalesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const range = parseDateRange(params);

  const deliveryParam = typeof params.delivery === "string" ? params.delivery : undefined;
  const deliveryStatus = DELIVERY_VALUES.includes(deliveryParam as DeliveryStatusValue)
    ? (deliveryParam as DeliveryStatusValue)
    : undefined;

  const [summary, sales, customers, deliveryCounts] = await Promise.all([
    getFinancialSummary(range),
    getSales({
      range,
      deliveryStatus,
      includeVoided: params.voided === "1",
      query: typeof params.q === "string" ? params.q : undefined,
    }),
    getCustomerBreakdown(range),
    getDeliveryCounts(range),
  ]);

  return (
    <SalesReport
      summary={summary}
      sales={sales}
      customers={customers}
      deliveryCounts={deliveryCounts}
      preset={range.preset}
      rangeLabel={range.label}
    />
  );
}
