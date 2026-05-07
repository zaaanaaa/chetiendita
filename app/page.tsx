import { CatalogClient } from "@/components/catalog-client";
import { getCurrentUser } from "@/lib/auth";
import { listProducts, listTags } from "@/lib/db";

export default async function HomePage() {
  const [user, products, tags] = await Promise.all([
    getCurrentUser(),
    Promise.resolve(listProducts()),
    Promise.resolve(listTags()),
  ]);

  return <CatalogClient initialProducts={products} tags={tags} user={user} />;
}
