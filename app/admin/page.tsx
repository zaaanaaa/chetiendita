import { redirect } from "next/navigation";

import { AdminClient } from "@/components/admin-client";
import { getCurrentUser } from "@/lib/auth";
import { listProducts, listTags } from "@/lib/db";

export default async function AdminPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/");
  }

  if (user.role !== "admin") {
    redirect("/");
  }

  const [products, tags] = await Promise.all([
    Promise.resolve(listProducts()),
    Promise.resolve(listTags()),
  ]);

  return <AdminClient user={user} initialProducts={products} initialTags={tags} />;
}
