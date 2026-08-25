import { NextResponse } from "next/server";
import { getVapidPublicKey } from "@/lib/push";

export const runtime = "nodejs";

export async function GET() {
  const key = getVapidPublicKey();
  if (!key) {
    return NextResponse.json({ error: "Push notifications not configured" }, { status: 503 });
  }
  return NextResponse.json({ publicKey: key });
}
