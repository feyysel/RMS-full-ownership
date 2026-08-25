import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/guard";
import { getCached, setCached } from "@/lib/cache";

const QUEUE_TTL = 5000;

export const runtime = "nodejs";

export async function GET(req: Request) {
  const guard = await requireRoles(req, ["KITCHEN", "MANAGER", "OWNER"]);
  if ("response" in guard) return guard.response;
  const session = guard.session;
  if (!session.restaurantId)
    return NextResponse.json({ error: "No restaurant assigned" }, { status: 400 });

  const cacheKey = `kitchen-queue:${session.restaurantId}`;
  const cached = getCached<unknown>(cacheKey);
  if (cached) return NextResponse.json(cached);

  const [active, recent] = await Promise.all([
    prisma.order.findMany({
      where: {
        restaurantId: session.restaurantId,
        status: { in: ["PENDING", "ACCEPTED", "COOKING"] },
      },
      include: {
        items: { select: { id: true, name: true, quantity: true, price: true } },
        table: { select: { number: true, code: true } },
        waiter: { select: { id: true, name: true } },
      },
      orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    }),
    prisma.order.findMany({
      where: {
        restaurantId: session.restaurantId,
        status: { in: ["READY", "SERVED", "COMPLETED"] },
      },
      include: {
        items: { select: { id: true, name: true, quantity: true, price: true } },
        receipt: { select: { id: true, total: true } },
        table: { select: { number: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const counts = active.reduce<Record<string, number>>((acc, o) => {
    acc[o.status] = (acc[o.status] ?? 0) + 1;
    return acc;
  }, {});

  const result = { active, recent, counts };
  setCached(cacheKey, result, QUEUE_TTL);
  return NextResponse.json(result);
}
