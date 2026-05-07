import { NextResponse } from "next/server";

import { createUser } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { validateCredentials } from "@/lib/validation";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { username?: string; password?: string }
    | null;

  const validation = validateCredentials(body?.username || "", body?.password || "");
  if (!validation.ok) {
    return jsonError(validation.error, 400);
  }

  try {
    const user = createUser(validation.username, validation.password);
    return NextResponse.json({ user }, { status: 201 });
  } catch {
    return jsonError("username_exists", 400);
  }
}
