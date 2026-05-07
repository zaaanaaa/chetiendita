import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { createTag, listTags } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { validateTagName } from "@/lib/validation";

export async function GET() {
  return NextResponse.json({ tags: listTags() });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return jsonError("unauthorized", 401);
  }
  if (user.role !== "admin") {
    return jsonError("forbidden", 403);
  }

  const body = (await request.json().catch(() => null)) as { name?: string } | null;
  const validation = validateTagName(body?.name || "");

  if (!validation.ok) {
    return jsonError(validation.error, 400);
  }

  try {
    const tag = createTag(validation.name);
    return NextResponse.json({ tag }, { status: 201 });
  } catch {
    return jsonError("tag_exists", 400);
  }
}
