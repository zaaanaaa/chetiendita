import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { deleteProduct, findProduct, updateProduct } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { ProductInput } from "@/lib/types";
import { validateProductInput } from "@/lib/validation";

function parseProductId(value: string) {
  const productId = Number(value);
  if (!Number.isInteger(productId) || productId < 1) {
    return null;
  }
  return productId;
}

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) {
    return { error: jsonError("unauthorized", 401) };
  }
  if (user.role !== "admin") {
    return { error: jsonError("forbidden", 403) };
  }
  return { user };
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return auth.error;
  }

  const { id } = await context.params;
  const productId = parseProductId(id);
  if (!productId) {
    return jsonError("invalid_id", 400);
  }

  const body = (await request.json().catch(() => null)) as ProductInput | null;
  if (!body) {
    return jsonError("missing_fields", 400);
  }

  const validation = validateProductInput(body);
  if (!validation.ok) {
    return jsonError(validation.error, 400);
  }

  const existing = findProduct(productId);
  if (!existing) {
    return jsonError("not_found", 404);
  }

  const product = updateProduct(productId, validation.product);
  return NextResponse.json({ product });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return auth.error;
  }

  const { id } = await context.params;
  const productId = parseProductId(id);
  if (!productId) {
    return jsonError("invalid_id", 400);
  }

  const existing = findProduct(productId);
  if (!existing) {
    return jsonError("not_found", 404);
  }

  deleteProduct(productId);
  return NextResponse.json({ ok: true });
}
