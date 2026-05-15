"use client";

import { StorefrontClient } from "@/components/storefront-client";
import { Product, Tag, User } from "@/lib/types";

interface CatalogFullClientProps {
  initialProducts: Product[];
  tags: Tag[];
  user: User | null;
}

export function CatalogFullClient(props: CatalogFullClientProps) {
  return <StorefrontClient {...props} mode="catalog" heroImages={[]} />;
}
