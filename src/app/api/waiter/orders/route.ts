import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/guard";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const guard = await requireRoles(req, ["WAITER", "MANAGER", "OWNER"]);
  if ("response" in guard) return guard.response;
  const session = guard.session;
  if (!session.restaurantId)
    return NextResponse.json({ error: "No restaurant assigned" }, { status: 400 });

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

  return NextResponse.json({ orders: active });
}
