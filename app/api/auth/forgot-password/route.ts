import { NextResponse } from "next/server";

import { createPasswordRecoveryCode, findUserByEmail } from "@/lib/db";
import { validateRecoveryEmail } from "@/lib/validation";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { email?: string } | null;
  const validation = validateRecoveryEmail(body?.email || "");

  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const user = findUserByEmail(validation.email);
  if (!user) {
    return NextResponse.json({ sent: true });
  }

  const { code } = createPasswordRecoveryCode(validation.email);

  return NextResponse.json({
    sent: true,
    previewCode: process.env.NODE_ENV === "production" ? undefined : code,
  });
}
