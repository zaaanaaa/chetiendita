import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { findOrder, updateOrderStatus } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { OrderStatus } from "@/lib/types";

const VALID_STATUSES: OrderStatus[] = ["pending", "accepted", "modified", "rejected"];

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return jsonError("forbidden", 403);
  }

  const { id } = await context.params;
  const orderId = Number(id);
  if (!Number.isInteger(orderId) || orderId < 1) {
    return jsonError("invalid_id", 400);
  }

  const existing = findOrder(orderId);
  if (!existing) {
    return jsonError("not_found", 404);
  }

  const body = (await request.json().catch(() => null)) as { status?: string } | null;
  if (!body?.status || !VALID_STATUSES.includes(body.status as OrderStatus)) {
    return jsonError("invalid_status", 400);
  }

  const order = updateOrderStatus(orderId, body.status as OrderStatus);
  return NextResponse.json({ order });
}
