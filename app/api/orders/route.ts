import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { createOrder, listOrders } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { OrderInput } from "@/lib/types";
import { validateOrderInput } from "@/lib/validation";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as OrderInput | null;
  if (!body) {
    return jsonError("missing_fields", 400);
  }

  const validation = validateOrderInput(body);
  if (!validation.ok) {
    return jsonError(validation.error, 400);
  }

  const order = createOrder({
    customerName: validation.order.customerName,
    customerPhone: validation.order.customerPhone,
    notes: validation.order.notes,
    items: validation.order.items,
    total: validation.order.total,
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
