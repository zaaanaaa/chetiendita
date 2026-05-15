import { CatalogClient } from "@/components/catalog-client";
import { getCurrentUser } from "@/lib/auth";
import { getHeroSettings, listProducts, listTags } from "@/lib/db";

export default async function HomePage() {
  const [user, products, tags, hero] = await Promise.all([
    getCurrentUser(),
    Promise.resolve(listProducts()),
    Promise.resolve(listTags()),
    Promise.resolve(getHeroSettings()),
  ]);

  return <CatalogClient initialProducts={products} tags={tags} user={user} heroImages={hero.images} />;
}
