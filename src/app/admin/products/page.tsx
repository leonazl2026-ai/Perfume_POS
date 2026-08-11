import { ProductManager } from "@/components/admin/ProductManager";
import { getAdminVariants, getProductOptions, getSuppliers } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  const [variants, products, suppliers] = await Promise.all([
    getAdminVariants(),
    getProductOptions(),
    getSuppliers(),
  ]);

  return <ProductManager variants={variants} products={products} suppliers={suppliers} />;
}
