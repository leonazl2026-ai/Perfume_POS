import { CustomerManager } from "@/components/admin/CustomerManager";
import { getCrmSummary, getCustomers } from "@/lib/crmQueries";
import { isOrderChannel } from "@/lib/channels";
import { CUSTOMER_TIERS, type CustomerTierValue } from "@/lib/tiers";
import { getSettings, loyaltyConfig } from "@/lib/settings";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;

  const tierParam = typeof params.tier === "string" ? params.tier : undefined;
  const channelParam = typeof params.channel === "string" ? params.channel : undefined;

  const [customers, summary, settings] = await Promise.all([
    getCustomers({
      query: typeof params.q === "string" ? params.q : undefined,
      tier: CUSTOMER_TIERS.includes(tierParam as CustomerTierValue)
        ? (tierParam as CustomerTierValue)
        : undefined,
      channel: isOrderChannel(channelParam) ? channelParam : undefined,
    }),
    getCrmSummary(),
    getSettings(),
  ]);

  return (
    <CustomerManager
      customers={customers}
      summary={summary}
      loyalty={loyaltyConfig(settings)}
    />
  );
}
