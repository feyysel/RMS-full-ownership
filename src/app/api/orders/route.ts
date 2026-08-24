import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/guard";
import { notify, emitToTable } from "@/lib/notify";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const guard = await requireRoles(req, ["WAITER"]);
  if ("response" in guard) return guard.response;
  const session = guard.session;

  try {
    const { tableId, items, type = "DINE_IN", note } = await req.json();

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Order must have at least one item" }, { status: 400 });
    }

    const table = tableId
      ? await prisma.table.findUnique({ where: { id: tableId }, include: { restaurant: true } })
      : null;

    if (type === "DINE_IN" && !table)
      return NextResponse.json({ error: "Table not found" }, { status: 404 });

    const restaurantId =
      table?.restaurantId ?? session.restaurantId ?? null;
    if (!restaurantId)
      return NextResponse.json({ error: "No restaurant context" }, { status: 400 });

    const menuIds = items.map((i) => i.menuItemId);
    const menuItems = await prisma.menuItem.findMany({
      where: { id: { in: menuIds }, restaurantId },
    });
    const menuMap = new Map(menuItems.map((m) => [m.id, m]));
    for (const id of menuIds) {
      if (!menuMap.has(id))
        return NextResponse.json({ error: "Menu item not found" }, { status: 400 });
      const item = menuMap.get(id)!;
      if (!item.available)
        return NextResponse.json({ error: `"${item.name}" is not available` }, { status: 400 });
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
          tableId: table?.id ?? null,
          tableLabel: table ? `Table ${table.number}` : "Takeaway",
          waiterId: session.id,
          restaurantId,
          items: {
            create: items.map((i) => {
              const qty = Math.max(1, Number(i.quantity) || 1);
              const m = menuMap.get(i.menuItemId)!;
              return {
                menuItemId: m.id,
                name: m.name,
                price: m.price,
                quantity: qty,
              };
            }),
          },
        },
        include: {
          items: true,
          table: { select: { number: true, code: true } },
          waiter: { select: { id: true, name: true } },
        },
      });

      if (table) {
        await tx.table.update({
          where: { id: table.id },
          data: { status: "occupied" },
        });
      }

      return created;
    });

    await notify({
      role: "KITCHEN",
      restaurantId,
      type: "ORDER_NEW",
      title: `New order #${order.orderNumber}`,
      body: `${order.tableLabel} — ${order.items.length} item(s), total ${order.total.toFixed(2)} ETB`,
      orderId: order.id,
      tableId: order.tableId ?? undefined,
    });

    if (table?.waiterId && table.waiterId !== session.id) {
      await notify({
        userId: table.waiterId,
        restaurantId,
        type: "ORDER_CUSTOMER",
        title: `New order at Table ${table.number}`,
        body: `#${order.orderNumber} was placed by a customer.`,
        orderId: order.id,
        tableId: order.tableId ?? undefined,
      });
    }

    if (table?.code) {
      await emitToTable(table.code, "ORDER_UPDATE", {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        total: order.total,
        items: order.items.map((i) => ({ name: i.name, price: i.price, quantity: i.quantity })),
        createdAt: order.createdAt.toISOString(),
      });
    }

    return NextResponse.json({ order });
  } catch (err) {
    console.error("create order error", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
