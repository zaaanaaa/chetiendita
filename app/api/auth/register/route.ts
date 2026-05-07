import { NextResponse } from "next/server";

import { createUser } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { validateRegistrationInput } from "@/lib/validation";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { username?: string; email?: string; password?: string }
    | null;

  const validation = validateRegistrationInput(
    body?.username || "",
    body?.email || "",
    body?.password || "",
  );
  if (!validation.ok) {
    return jsonError(validation.error, 400);
  }

  try {
    const user = createUser(validation.username, validation.email, validation.password);
    return NextResponse.json({ user }, { status: 201 });
  } catch {
    return jsonError("username_or_email_exists", 400);
  }
}
