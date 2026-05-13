import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { deleteUserRecord, findUser, getUserWithOrders, updateManagedUser } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { UserInput } from "@/lib/types";
import { validateAdminUserInput } from "@/lib/validation";

function parseUserId(value: string) {
  const userId = Number(value);
  if (!Number.isInteger(userId) || userId < 1) {
    return null;
  }
  return userId;
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

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return auth.error;
  }

  const { id } = await context.params;
  const userId = parseUserId(id);
  if (!userId) {
    return jsonError("invalid_id", 400);
  }

  const user = getUserWithOrders(userId);
  if (!user) {
    return jsonError("not_found", 404);
  }

  return NextResponse.json({ user });
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
  const userId = parseUserId(id);
  if (!userId) {
    return jsonError("invalid_id", 400);
  }

  if (!findUser(userId)) {
    return jsonError("not_found", 404);
  }

  const body = (await request.json().catch(() => null)) as UserInput | null;
  if (!body) {
    return jsonError("missing_fields", 400);
  }

  const validation = validateAdminUserInput(body);
  if (!validation.ok) {
    return jsonError(validation.error, 400);
  }

  try {
    const user = updateManagedUser(userId, validation.user);
    return NextResponse.json({ user });
  } catch {
    return jsonError("username_or_email_exists", 400);
  }
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
  const userId = parseUserId(id);
  if (!userId) {
    return jsonError("invalid_id", 400);
  }

  if (auth.user.id === userId) {
    return jsonError("forbidden", 403);
  }

  if (!findUser(userId)) {
    return jsonError("not_found", 404);
  }

  deleteUserRecord(userId);
  return NextResponse.json({ ok: true });
}
