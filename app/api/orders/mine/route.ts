import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { listOrdersByUser } from "@/lib/db";
import { jsonError } from "@/lib/http";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return jsonError("unauthorized", 401);
  }

  return NextResponse.json({ orders: listOrdersByUser(user.id) });
}
