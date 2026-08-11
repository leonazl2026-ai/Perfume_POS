import Link from "next/link";
import { SalesReport } from "@/components/admin/SalesReport";
import { ChannelPanel, PaymentPanel } from "@/components/admin/AnalyticsPanels";
import { getChannelPerformance, getPaymentBreakdown } from "@/lib/analytics";
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

  const [summary, sales, customers, deliveryCounts, payments, channels] = await Promise.all([
    getFinancialSummary(range),
    getSales({
      range,
      deliveryStatus,
      includeVoided: params.voided === "1",
      query: typeof params.q === "string" ? params.q : undefined,
    }),
    getCustomerBreakdown(range),
    getDeliveryCounts(range),
    getPaymentBreakdown(range),
    getChannelPerformance(range),
  ]);

  return (
    <>
      <SalesReport
        summary={summary}
        sales={sales}
        customers={customers}
        deliveryCounts={deliveryCounts}
        preset={range.preset}
        rangeLabel={range.label}
      />

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PaymentPanel rows={payments} />
        <ChannelPanel rows={channels} />
      </div>

      <p className="mt-3 text-xs text-gray-400">
        Deeper rankings — best sellers, decant size mix, dead stock — live under{" "}
        <Link href="/admin/analytics" className="font-medium text-gray-600 hover:text-gray-900">
          Analytics
        </Link>
        .
      </p>
    </>
  );
}
