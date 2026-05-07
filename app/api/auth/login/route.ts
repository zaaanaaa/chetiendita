import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { createSession, findUserByCredentials } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { SESSION_COOKIE } from "@/lib/session";
import { validateCredentials } from "@/lib/validation";
import { generateSessionToken } from "@/lib/auth";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { username?: string; password?: string }
    | null;

  const validation = validateCredentials(body?.username || "", body?.password || "");
  if (!validation.ok) {
    return jsonError(validation.error, 400);
  }

  const user = findUserByCredentials(validation.username, validation.password);
  if (!user) {
    return jsonError("invalid_credentials", 401);
  }

  const token = generateSessionToken();
  createSession(user.id, token);

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return NextResponse.json({ user });
}
