import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/guard";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const guard = await requireRoles(req, ["KITCHEN", "MANAGER", "OWNER"]);
  if ("response" in guard) return guard.response;
  const session = guard.session;
  if (!session.restaurantId)
    return NextResponse.json({ error: "No restaurant assigned" }, { status: 400 });

  const receipts = await prisma.receipt.findMany({
    where: {
      restaurantId: session.restaurantId,
      order: {
        status: { in: ["ACCEPTED", "COOKING", "READY", "SERVED", "COMPLETED"] },
      },
      ...(session.role === "KITCHEN" ? { kitchenId: session.id } : {}),
    },
    include: {
      order: {
        include: {
          table: { select: { number: true } },
          waiter: { select: { id: true, name: true } },
          cashier: { select: { id: true, name: true } },
        },
      },
      kitchen: { select: { id: true, name: true } },
    },
    orderBy: { generatedAt: "desc" },
    take: 50,
  });

  return NextResponse.json({
    receipts: receipts.map((r) => ({
      id: r.id,
      orderId: r.orderId,
      orderNumber: r.order.orderNumber,
      tableLabel: r.order.tableLabel,
      type: r.order.type,
      items: JSON.parse(r.items) as {
        name: string;
        price: number;
        quantity: number;
      }[],
      subtotal: r.subtotal,
      tax: r.tax,
      total: r.total,
      kitchenName: r.kitchen?.name ?? "Kitchen",
      cashierName: r.order.cashier?.name ?? "Cashier",
      waiterName: r.order.waiter?.name ?? "—",
      generatedAt: r.generatedAt,
    })),
  });
}
