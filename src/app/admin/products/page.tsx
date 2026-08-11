import { ProductManager } from "@/components/admin/ProductManager";
import { getAdminVariants, getProductOptions } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  const [variants, products] = await Promise.all([getAdminVariants(), getProductOptions()]);

  return <ProductManager variants={variants} products={products} />;
}
