import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { createProduct, listProducts } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { ProductInput } from "@/lib/types";
import { validateProductInput } from "@/lib/validation";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";
  const tag = searchParams.get("tag") || "";

  return NextResponse.json({
    products: listProducts({ search, tag }),
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return jsonError("unauthorized", 401);
  }
  if (user.role !== "admin") {
    return jsonError("forbidden", 403);
  }

  const body = (await request.json().catch(() => null)) as ProductInput | null;
  if (!body) {
    return jsonError("missing_fields", 400);
  }

  const validation = validateProductInput(body);
  if (!validation.ok) {
    return jsonError(validation.error, 400);
  }

  const product = createProduct(validation.product);
  return NextResponse.json({ product }, { status: 201 });
}
