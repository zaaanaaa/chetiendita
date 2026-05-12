import { redirect } from "next/navigation";

import { UserOrdersClient } from "@/components/user-orders-client";
import { getCurrentUser } from "@/lib/auth";
import { listOrdersByUser } from "@/lib/db";

export const metadata = {
  title: "Mis pedidos — Che Tiendita",
  description: "Estado e historial de tus pedidos en Che Tiendita.",
};

export default async function PedidosPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/");
  }

  const orders = listOrdersByUser(user.id);

  return <UserOrdersClient user={user} orders={orders} />;
}
