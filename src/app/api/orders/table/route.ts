import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const code = new URL(req.url).searchParams.get("code");
    if (!code)
      return NextResponse.json({ error: "Table code is required" }, { status: 400 });

    const table = await prisma.table.findUnique({
      where: { code },
      select: { id: true, restaurantId: true },
    });
    if (!table)
      return NextResponse.json({ error: "Invalid table code" }, { status: 404 });

    const orders = await prisma.order.findMany({
      where: {
        OR: [{ tableId: table.id }, { sourceTableCode: code }],
        status: { in: ["PENDING", "ACCEPTED", "COOKING", "READY", "SERVED", "COMPLETED"] },
      },
      include: {
        items: { select: { id: true, name: true, price: true, quantity: true, status: true } },
        receipt: { select: { id: true, subtotal: true, tax: true, total: true, generatedAt: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 6,
    });

    return NextResponse.json({
      orders: orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        type: o.type,
        note: o.note,
        tableLabel: o.tableLabel,
        total: o.total,
        createdAt: o.createdAt,
        items: o.items,
        receipt: o.receipt
          ? {
              subtotal: o.receipt.subtotal,
              tax: o.receipt.tax,
              total: o.receipt.total,
              generatedAt: o.receipt.generatedAt,
            }
          : null,
      })),
    });
  } catch (err) {
    console.error("table orders error", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
