import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/guard";
import { getCached, setCached } from "@/lib/cache";

export const runtime = "nodejs";

const WAITER_TTL = 3000;

export async function GET(req: Request) {
  const guard = await requireRoles(req, ["WAITER", "CASHIER", "MANAGER", "OWNER"]);
  if ("response" in guard) return guard.response;
  const session = guard.session;
  if (!session.restaurantId)
    return NextResponse.json({ error: "No restaurant assigned" }, { status: 400 });

  const cacheKey = `waiter-orders:${session.restaurantId}`;
  const cached = getCached<unknown>(cacheKey);
  if (cached) return NextResponse.json(cached);

  const active = await prisma.order.findMany({
    where: {
      restaurantId: session.restaurantId,
      status: { in: ["PENDING", "ACCEPTED", "COOKING", "READY", "SERVED"] },
    },
    include: {
      items: { select: { id: true, name: true, quantity: true, price: true } },
      receipt: { select: { subtotal: true, tax: true, total: true } },
      table: { select: { number: true, code: true } },
      waiter: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const result = { orders: active };
  setCached(cacheKey, result, WAITER_TTL);
  return NextResponse.json(result);
}
