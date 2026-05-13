import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { createManagedUser, listUsers } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { UserInput } from "@/lib/types";
import { validateAdminUserInput } from "@/lib/validation";

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

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return auth.error;
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";

  return NextResponse.json({ users: listUsers(search) });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return auth.error;
  }

  const body = (await request.json().catch(() => null)) as UserInput | null;
  if (!body) {
    return jsonError("missing_fields", 400);
  }

  const validation = validateAdminUserInput(body, { requirePassword: true });
  if (!validation.ok) {
    return jsonError(validation.error, 400);
  }

  try {
    const user = createManagedUser(validation.user);
    return NextResponse.json({ user }, { status: 201 });
  } catch {
    return jsonError("username_or_email_exists", 400);
  }
}
