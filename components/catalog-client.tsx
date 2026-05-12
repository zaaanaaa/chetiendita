"use client";

import { StorefrontClient } from "@/components/storefront-client";
import { Product, Tag, User } from "@/lib/types";

interface CatalogClientProps {
  initialProducts: Product[];
  tags: Tag[];
  user: User | null;
}

export function CatalogClient(props: CatalogClientProps) {
  return <StorefrontClient {...props} mode="home" />;
}
