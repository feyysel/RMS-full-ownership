import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const guard = await requireRoles(req, ["MANAGER", "OWNER"]);
  if ("response" in guard) return guard.response;
  const session = guard.session;
  if (!session.restaurantId)
    return NextResponse.json({ error: "No restaurant assigned" }, { status: 400 });

  const orders = await prisma.order.findMany({
    where: {
      restaurantId: session.restaurantId,
      refundStatus: "REQUESTED",
      refunded: false,
    },
    orderBy: { refundRequestedAt: "desc" },
    take: 100,
    include: {
      items: { select: { id: true, name: true, quantity: true, price: true } },
      receipt: { select: { total: true, paymentMethod: true, paidAt: true } },
      cashier: { select: { id: true, name: true } },
      waiter: { select: { id: true, name: true } },
      table: { select: { number: true } },
    },
  });

  return NextResponse.json({
    refunds: orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      tableLabel: o.tableLabel,
      total: o.receipt?.total ?? o.total,
      paymentMethod: o.paymentMethod ?? o.receipt?.paymentMethod ?? null,
      paidAt: (o.paidAt ?? o.receipt?.paidAt)?.toISOString() ?? null,
      reason: o.refundReason ?? null,
      requestedAt: o.refundRequestedAt?.toISOString() ?? null,
      requestedBy: o.cashier?.name ?? null,
      requestedById: o.cashier?.id ?? null,
      waiterName: o.waiter?.name ?? null,
      items: o.items.map((i) => ({ name: i.name, quantity: i.quantity, price: i.price })),
    })),
  });
}
