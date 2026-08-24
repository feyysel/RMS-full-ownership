import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/guard";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const guard = await requireRoles(req, ["OWNER", "MANAGER", "KITCHEN", "WAITER"]);
  if ("response" in guard) return guard.response;
  const session = guard.session;

  const notifications = await prisma.notification.findMany({
    where: {
      restaurantId: session.restaurantId ?? undefined,
      OR: session.restaurantId
        ? [
            { userId: session.id },
            { userId: null, role: session.role },
            { role: null, userId: null },
          ]
        : [{ userId: session.id }],
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const unread = notifications.filter((n) => !n.read).length;

  return NextResponse.json({ notifications, unread });
}

export async function POST(req: Request) {
  const guard = await requireRoles(req, ["OWNER", "MANAGER", "KITCHEN", "WAITER"]);
  if ("response" in guard) return guard.response;
  const session = guard.session;

  const { ids } = await req.json().catch(() => ({ ids: null }));

  const scope: Record<string, unknown> = session.restaurantId
    ? {
        OR: [
          { userId: session.id },
          { userId: null, role: session.role },
        ],
      }
    : { userId: session.id };

  if (Array.isArray(ids) && ids.length > 0) {
    await prisma.notification.updateMany({
      where: { id: { in: ids }, ...scope },
      data: { read: true },
    });
  } else {
    await prisma.notification.updateMany({
      where: scope,
      data: { read: true },
    });
  }

  return NextResponse.json({ ok: true });
}
