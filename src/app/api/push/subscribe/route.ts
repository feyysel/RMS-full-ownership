import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { endpoint, p256dh, auth } = await req.json();
    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json(
        { error: "Invalid subscription" },
        { status: 400 }
      );
    }

    const userAgent = req.headers.get("user-agent") || null;

    const existing = await prisma.pushSubscription.findFirst({
      where: { endpoint },
    });

    if (existing) {
      await prisma.pushSubscription.update({
        where: { id: existing.id },
        data: { p256dh, auth, userId: session.id, userAgent },
      });
    } else {
      await prisma.pushSubscription.create({
        data: {
          endpoint,
          p256dh,
          auth,
          userId: session.id,
          restaurantId: session.restaurantId,
          userAgent,
        },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("push subscribe error", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
