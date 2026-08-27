import { NextResponse, after } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/guard";
import { notify, emitToTable } from "@/lib/notify";
import { persistEvent } from "@/lib/realtime";
import { invalidateCache, escapeRegExp } from "@/lib/cache";
import { TAX_RATE } from "@/lib/constants";
import type { OrderStatus, OrderItemStatus } from "@/generated/prisma/client";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

const ITEM_STATUSES: OrderItemStatus[] = [
  "PENDING",
  "ACCEPTED",
  "COOKING",
  "READY",
  "SERVED",
];

const ACTIONS: Record<
  string,
  {
    from: OrderStatus[];
    to: OrderStatus;
    roles: string[];
  }
> = {
  accept: { from: ["PENDING"], to: "ACCEPTED", roles: ["KITCHEN", "MANAGER"] },
  cook: { from: ["ACCEPTED"], to: "COOKING", roles: ["KITCHEN", "MANAGER"] },
  ready: { from: ["COOKING"], to: "READY", roles: ["KITCHEN", "MANAGER"] },
  serve: { from: ["READY"], to: "SERVED", roles: ["WAITER", "MANAGER"] },
  complete: { from: ["SERVED"], to: "COMPLETED", roles: ["WAITER", "MANAGER"] },
  cancel: { from: ["PENDING", "ACCEPTED", "COOKING"], to: "CANCELLED", roles: ["KITCHEN", "WAITER", "MANAGER"] },
};

export async function GET(req: Request, ctx: Ctx) {
  const guard = await requireRoles(req, ["KITCHEN", "WAITER", "MANAGER", "OWNER"]);
  if ("response" in guard) return guard.response;
  const session = guard.session;
  const { id } = await ctx.params;

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: true,
      receipt: true,
      table: { select: { number: true, code: true, waiterId: true } },
      waiter: { select: { id: true, name: true } },
    },
  });

  if (!order || order.restaurantId !== session.restaurantId)
    return NextResponse.json({ error: "Order not found" }, { status: 404 });

  return NextResponse.json({ order });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const guard = await requireRoles(req, ["KITCHEN", "WAITER", "MANAGER", "OWNER"]);
  if ("response" in guard) return guard.response;
  const session = guard.session;
  const { id } = await ctx.params;

  try {
    const { action, collectedAmount } = await req.json();
    const def = ACTIONS[action];
    if (!def) return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    if (!def.roles.includes(session.role))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const order = await prisma.order.findUnique({
      where: { id },
      select: { id: true, restaurantId: true, orderNumber: true, status: true, tableId: true, tableLabel: true, waiterId: true, total: true },
    });
    if (!order || order.restaurantId !== session.restaurantId)
      return NextResponse.json({ error: "Order not found" }, { status: 404 });

    if (!def.from.includes(order.status)) {
      return NextResponse.json(
        { error: `Cannot "${action}" an order that is ${order.status}` },
        { status: 409 }
      );
    }

    const collected =
      action === "complete" && collectedAmount != null
        ? Math.max(0, Math.round(Number(collectedAmount) * 100) / 100)
        : null;

    if (collected != null && !Number.isFinite(collected))
      return NextResponse.json({ error: "Invalid amount collected" }, { status: 400 });

    const updated = await prisma.$transaction(async (tx) => {
      const full = await tx.order.findUniqueOrThrow({
        where: { id },
        include: { items: true, table: true, receipt: true },
      });

      const payable = full.receipt?.total ?? full.total;
      const tip =
        collected != null
          ? Math.max(0, Math.round((collected - payable) * 100) / 100)
          : null;

      const updatedOrder = await tx.order.update({
        where: { id },
        data: {
          status: def.to,
          ...(collected != null ? { collectedAmount: collected, tip } : {}),
        },
        include: { items: true, table: true, receipt: true },
      });

      if (ITEM_STATUSES.includes(def.to as OrderItemStatus)) {
        await tx.orderItem.updateMany({
          where: { orderId: id },
          data: { status: def.to as OrderItemStatus },
        });
      }

      if (action === "ready") {
        const subtotal = full.items.reduce((s, i) => s + i.price * i.quantity, 0);
        const tax = Math.round(subtotal * TAX_RATE * 100) / 100;
        const total = Math.round((subtotal + tax) * 100) / 100;
        await tx.receipt.upsert({
          where: { orderId: id },
          update: {
            items: JSON.stringify(
              full.items.map((i) => ({ name: i.name, price: i.price, quantity: i.quantity }))
            ),
            subtotal,
            tax,
            total,
            kitchenId: session.id,
          },
          create: {
            orderId: id,
            items: JSON.stringify(
              full.items.map((i) => ({ name: i.name, price: i.price, quantity: i.quantity }))
            ),
            subtotal,
            tax,
            total,
            kitchenId: session.id,
            restaurantId: full.restaurantId,
          },
        });
      }

      if ((action === "complete" || action === "cancel") && full.tableId) {
        const otherActive = await tx.order.count({
          where: {
            tableId: full.tableId,
            status: { in: ["PENDING", "ACCEPTED", "COOKING", "READY", "SERVED"] },
          },
        });
        if (otherActive === 0) {
          await tx.table.update({ where: { id: full.tableId }, data: { status: "free" } });
        }
      }

      return updatedOrder;
    });

    const summary = `Order #${updated.orderNumber}`;
    const restaurantId = order.restaurantId;

    invalidateCache(`^kitchen-queue:${escapeRegExp(restaurantId)}$`);
    invalidateCache(`^notifs:.*:${escapeRegExp(restaurantId)}$`);
    invalidateCache(`^stats:${escapeRegExp(restaurantId)}$`);

    if (action === "complete" || action === "cancel") {
      invalidateCache(`^tables:${escapeRegExp(restaurantId)}`);
    }

    after(async () => {
      try {
        const tableCode = updated.sourceTableCode ?? updated.table?.code;

        await persistEvent(
          { scope: "restaurant", restaurantId },
          "ORDER_STATUS_CHANGED",
          {
            id,
            orderNumber: updated.orderNumber,
            status: updated.status,
            tableLabel: updated.tableLabel,
            action,
          }
        );

        if (action === "ready") {
          const receipt = await prisma.receipt.findUnique({ where: { orderId: id } });
          if (updated.waiterId) {
            await notify({
              userId: updated.waiterId,
              restaurantId,
              type: "ORDER_READY",
              title: `${summary} is ready`,
              body: `Ready for delivery — total ${receipt?.total.toFixed(2)} ETB`,
              orderId: id,
              tableId: updated.tableId ?? undefined,
            });
          }
          if (tableCode) {
            await emitToTable(tableCode, "ORDER_UPDATE", {
              id,
              orderNumber: updated.orderNumber,
              status: "READY",
              receipt: receipt
                ? {
                    subtotal: receipt.subtotal,
                    tax: receipt.tax,
                    total: receipt.total,
                    items: JSON.parse(receipt.items),
                  }
                : null,
            });
          }
        } else if (tableCode) {
          await emitToTable(tableCode, "ORDER_UPDATE", {
            id,
            orderNumber: updated.orderNumber,
            status: updated.status,
          });
        }

        if (action === "accept" || action === "cook") {
          const statusText = action === "accept" ? "accepted" : "now cooking";
          if (updated.waiterId) {
            await notify({
              userId: updated.waiterId,
              restaurantId,
              type: "ORDER_STATUS",
              title: `${summary} ${statusText}`,
              body: `${updated.tableLabel} is ${action === "accept" ? "accepted by the kitchen" : "being cooked"}.`,
              orderId: id,
              tableId: updated.tableId ?? undefined,
            });
          } else {
            await notify({
              role: "WAITER",
              restaurantId,
              type: "ORDER_STATUS",
              title: `${summary} ${statusText}`,
              body: `${updated.tableLabel} is ${action === "accept" ? "accepted by the kitchen" : "being cooked"}.`,
              orderId: id,
              tableId: updated.tableId ?? undefined,
            });
          }
        }
      } catch (err) {
        console.error("order action side-effect failed", err);
      }
    });

    return NextResponse.json({ order: updated });
  } catch (err) {
    console.error("order action error", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
