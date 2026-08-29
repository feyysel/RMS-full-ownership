import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/guard";
import { getCached, setCached } from "@/lib/cache";

const CASHIER_TTL = 5000;

export const runtime = "nodejs";

export async function GET(req: Request) {
  const guard = await requireRoles(req, ["CASHIER", "MANAGER", "OWNER"]);
  if ("response" in guard) return guard.response;
  const session = guard.session;
  if (!session.restaurantId)
    return NextResponse.json({ error: "No restaurant assigned" }, { status: 400 });

  const cacheKey = `cashier-orders:${session.restaurantId}`;
  const cached = getCached<unknown>(cacheKey);
  if (cached) return NextResponse.json(cached);

  const orders = await prisma.order.findMany({
    where: {
      restaurantId: session.restaurantId,
      status: { in: ["TAKEN", "PAID", "ACCEPTED", "COOKING", "READY", "SERVED"] },
    },
    include: {
      items: { select: { id: true, name: true, quantity: true, price: true } },
      receipt: { select: { subtotal: true, discount: true, tax: true, total: true, paymentMethod: true, paidAt: true } },
      table: { select: { number: true, code: true } },
      waiter: { select: { id: true, name: true } },
      cashier: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const result = { orders };
  setCached(cacheKey, result, CASHIER_TTL);
  return NextResponse.json(result);
}
