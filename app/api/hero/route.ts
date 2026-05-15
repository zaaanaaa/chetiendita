import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { getHeroSettings, updateHeroSettings } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { HeroSettings } from "@/lib/types";
import { validateHeroSettings } from "@/lib/validation";

export async function GET() {
  return NextResponse.json({ hero: getHeroSettings() });
}

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return jsonError("forbidden", 403);
  }

  const body = (await request.json().catch(() => null)) as HeroSettings | null;
  if (!body) {
    return jsonError("invalid_input", 400);
  }

  const validation = validateHeroSettings(body);
  if (!validation.ok) {
    return jsonError("invalid_input", 400);
  }

  return NextResponse.json({ hero: updateHeroSettings(validation.hero) });
}
