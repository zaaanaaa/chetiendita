import { NextResponse } from "next/server";

import { createUser, generateUniqueUsernameFromEmail } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { validatePublicRegistrationInput } from "@/lib/validation";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { name?: string; email?: string; phone?: string; password?: string }
    | null;

  const validation = validatePublicRegistrationInput(
    body?.name || "",
    body?.email || "",
    body?.phone || "",
    body?.password || "",
  );
  if (!validation.ok) {
    return jsonError(validation.error, 400);
  }

  try {
    const user = createUser(
      generateUniqueUsernameFromEmail(validation.email),
      validation.email,
      validation.password,
      {
        name: validation.name,
        phone: validation.phone,
        role: "user",
      },
    );
    return NextResponse.json({ user }, { status: 201 });
  } catch {
    return jsonError("username_or_email_exists", 400);
  }
}
