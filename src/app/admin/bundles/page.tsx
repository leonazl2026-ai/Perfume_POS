import { BundleBuilder } from "@/components/admin/BundleBuilder";
import { getAdminBundles, getAdminVariants } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function AdminBundlesPage() {
  const [bundles, variants] = await Promise.all([getAdminBundles(), getAdminVariants()]);

  return <BundleBuilder bundles={bundles} variants={variants} />;
}
