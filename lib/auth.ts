import crypto from "node:crypto";

import { cookies } from "next/headers";

import { findSessionUser } from "@/lib/db";
import { SESSION_COOKIE } from "@/lib/session";

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  return findSessionUser(token);
}

export function generateSessionToken() {
  return crypto.randomBytes(24).toString("hex");
}
