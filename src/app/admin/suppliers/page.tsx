import { SupplierManager } from "@/components/admin/SupplierManager";
import { getSuppliers } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function AdminSuppliersPage() {
  const suppliers = await getSuppliers(true);
  return <SupplierManager suppliers={suppliers} />;
}
