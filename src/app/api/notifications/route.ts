import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/guard";
import { getCached, setCached } from "@/lib/cache";

const NOTIF_TTL = 15000;

export const runtime = "nodejs";

export async function GET(req: Request) {
  const guard = await requireRoles(req, ["OWNER", "MANAGER", "KITCHEN", "WAITER", "CASHIER"]);
  if ("response" in guard) return guard.response;
  const session = guard.session;

  const cacheKey = `notifs:${session.id}:${session.restaurantId ?? "none"}`;
  const cached = getCached<unknown>(cacheKey);
  if (cached) return NextResponse.json(cached);

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
    select: {
      id: true,
      title: true,
      body: true,
      type: true,
      read: true,
      createdAt: true,
    },
  });

  const unread = notifications.filter((n) => !n.read).length;

  const result = { notifications, unread };
  setCached(cacheKey, result, NOTIF_TTL);
  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const guard = await requireRoles(req, ["OWNER", "MANAGER", "KITCHEN", "WAITER", "CASHIER"]);
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

  const cacheKey = `notifs:${session.id}:${session.restaurantId ?? "none"}`;
  const { invalidateCache } = await import("@/lib/cache");
  invalidateCache(`^${cacheKey.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`);

  return NextResponse.json({ ok: true });
}
