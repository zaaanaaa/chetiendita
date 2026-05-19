import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { createOrder, listOrders } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { OrderInput } from "@/lib/types";
import { validateOrderInput } from "@/lib/validation";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return jsonError("unauthorized", 401);
  }

  const body = (await request.json().catch(() => null)) as OrderInput | null;
  if (!body) {
    return jsonError("missing_fields", 400);
  }

  const validation = validateOrderInput(body);
  if (!validation.ok) {
    return jsonError(validation.error, 400);
  }

  const requestedUserId =
    typeof validation.order.userId === "number" && validation.order.userId > 0
      ? validation.order.userId
      : null;

  const isAdmin = user.role === "admin";
  const effectiveUserId = isAdmin ? requestedUserId : user.id;
  const customerName = isAdmin
    ? validation.order.customerName || "Cliente"
    : validation.order.customerName || user.name || user.username || "Cliente";
  const customerPhone = isAdmin
    ? validation.order.customerPhone || ""
    : validation.order.customerPhone || user.phone || "";

  const order = createOrder({
    userId: effectiveUserId,
    customerName,
    customerPhone,
    notes: validation.order.notes,
    items: validation.order.items,
    total: validation.order.total,
    status: isAdmin ? "accepted" : "pending",
  });

  return NextResponse.json({ order }, { status: 201 });
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return jsonError("forbidden", 403);
  }

  return NextResponse.json({ orders: listOrders() });
}
