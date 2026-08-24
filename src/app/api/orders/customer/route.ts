import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notify, emitToTable } from "@/lib/notify";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { code, items, type = "DINE_IN", note, customerName } = await req.json();

    if (!code) {
      return NextResponse.json({ error: "Table code is required" }, { status: 400 });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Order must have at least one item" }, { status: 400 });
    }

    const table = await prisma.table.findUnique({
      where: { code },
      include: { waiter: true },
    });

    if (!table) {
      return NextResponse.json({ error: "Invalid table code" }, { status: 404 });
    }

    const restaurantId = table.restaurantId;
    const menuIds = items.map((i) => i.menuItemId);
    const menuItems = await prisma.menuItem.findMany({
      where: { id: { in: menuIds }, restaurantId, available: true },
    });
    const menuMap = new Map(menuItems.map((m) => [m.id, m]));
    for (const id of menuIds) {
      if (!menuMap.has(id)) {
        return NextResponse.json({ error: "Menu item not found or unavailable" }, { status: 400 });
      }
    }

    const total = items.reduce((sum, i) => {
      const qty = Math.max(1, Number(i.quantity) || 1);
      return sum + (menuMap.get(i.menuItemId)!.price * qty);
    }, 0);

    const order = await prisma.$transaction(async (tx) => {
      const lastOrder = await tx.order.findFirst({
        where: { restaurantId },
        orderBy: { orderNumber: "desc" },
        select: { orderNumber: true },
      });
      const orderNumber = (lastOrder?.orderNumber ?? 0) + 1;

      const created = await tx.order.create({
        data: {
          orderNumber,
          type,
          note: note ?? null,
          total,
          tableId: type === "DINE_IN" ? table.id : null,
          sourceTableCode: table.code,
          tableLabel:
            type === "DINE_IN" ? `Table ${table.number}` : `Takeaway ${customerName ? `- ${customerName}` : ""}`,
          waiterId: table.waiterId,
          restaurantId,
          items: {
            create: items.map((i) => {
              const qty = Math.max(1, Number(i.quantity) || 1);
              const m = menuMap.get(i.menuItemId)!;
              return { menuItemId: m.id, name: m.name, price: m.price, quantity: qty };
            }),
          },
        },
        include: {
          items: true,
          table: { select: { number: true, code: true } },
          waiter: { select: { id: true, name: true } },
        },
      });

      if (type === "DINE_IN") {
        await tx.table.update({ where: { id: table.id }, data: { status: "occupied" } });
      }
      return created;
    });

    await notify({
      role: "KITCHEN",
      restaurantId,
      type: "ORDER_NEW",
      title: `New order #${order.orderNumber}`,
      body: `${order.tableLabel} — ${order.items.reduce((s, i) => s + i.quantity, 0)} item(s)`,
      orderId: order.id,
      tableId: order.tableId ?? undefined,
    });

    if (table.waiterId) {
      await notify({
        userId: table.waiterId,
        restaurantId,
        type: "ORDER_CUSTOMER",
        title: `New order at Table ${table.number}`,
        body: `Order #${order.orderNumber} placed by customer.`,
        orderId: order.id,
        tableId: order.tableId ?? undefined,
      });
    }

    await emitToTable(table.code, "ORDER_UPDATE", {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      total: order.total,
      items: order.items.map((i) => ({ name: i.name, price: i.price, quantity: i.quantity })),
      createdAt: order.createdAt.toISOString(),
    });

    return NextResponse.json({
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        total: order.total,
        tableLabel: order.tableLabel,
        items: order.items.map((i) => ({ id: i.id, name: i.name, price: i.price, quantity: i.quantity, status: i.status })),
        createdAt: order.createdAt,
      },
    });
  } catch (err) {
    console.error("customer order error", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
