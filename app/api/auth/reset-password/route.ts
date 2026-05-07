import { NextResponse } from "next/server";

import { resetPasswordWithRecoveryCode } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { validateRecoveryResetInput } from "@/lib/validation";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { code?: string; password?: string }
    | null;

  const validation = validateRecoveryResetInput(body?.code || "", body?.password || "");
  if (!validation.ok) {
    return jsonError(validation.error, 400);
  }

  const result = resetPasswordWithRecoveryCode(validation.code, validation.password);
  if (!result.ok) {
    return jsonError(result.error, 400);
  }

  return NextResponse.json({ ok: true });
}
