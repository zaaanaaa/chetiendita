import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { deleteOrder, findOrder, updateOrder, updateOrderStatus } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { OrderStatus, OrderUpdateInput } from "@/lib/types";
import { validateOrderUpdateInput } from "@/lib/validation";

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

  const body = (await request.json().catch(() => null)) as
    | ({ status?: string } & Partial<OrderUpdateInput>)
    | null;
  if (!body) {
    return jsonError("missing_fields", 400);
  }

  const hasFullUpdateFields =
    typeof body.customerName === "string" ||
    typeof body.customerPhone === "string" ||
    typeof body.notes === "string" ||
    Array.isArray(body.items);

  if (!hasFullUpdateFields) {
    if (!body.status || !VALID_STATUSES.includes(body.status as OrderStatus)) {
      return jsonError("invalid_status", 400);
    }

    const order = updateOrderStatus(orderId, body.status as OrderStatus);
    return NextResponse.json({ order });
  }

  const validation = validateOrderUpdateInput(body as OrderUpdateInput);
  if (!validation.ok) {
    return jsonError(validation.error, 400);
  }

  const order = updateOrder(orderId, {
    customerName: validation.order.customerName,
    customerPhone: validation.order.customerPhone,
    notes: validation.order.notes,
    status: validation.order.status ?? "modified",
    items: validation.order.items,
  });

  return NextResponse.json({ order });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return jsonError("unauthorized", 401);
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

  const canDeleteAsAdmin = user.role === "admin";
  const canCancelOwnPendingOrder =
    existing.userId === user.id && existing.status === "pending";

  if (!canDeleteAsAdmin && !canCancelOwnPendingOrder) {
    return jsonError("forbidden", 403);
  }

  deleteOrder(orderId);
  return NextResponse.json({ ok: true });
}
