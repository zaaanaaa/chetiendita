import { CatalogFullClient } from "@/components/catalog-full-client";
import { getCurrentUser } from "@/lib/auth";
import { listProducts, listTags } from "@/lib/db";

export const metadata = {
  title: "Catálogo — Che Tiendita",
  description: "Explorá nuestro catálogo completo de productos artesanales y de diseño.",
};

export default async function CatalogoPage() {
  const [user, products, tags] = await Promise.all([
    getCurrentUser(),
    Promise.resolve(listProducts()),
    Promise.resolve(listTags()),
  ]);

  return <CatalogFullClient initialProducts={products} tags={tags} user={user} />;
}
