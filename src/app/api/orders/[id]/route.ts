import { NextResponse, after } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/guard";
import { notify, emitToTable } from "@/lib/notify";
import { persistEvent } from "@/lib/realtime";
import { invalidateCache, escapeRegExp } from "@/lib/cache";
import { TAX_RATE } from "@/lib/constants";
import type { OrderStatus, OrderItemStatus, PaymentMethod } from "@/generated/prisma/client";

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
  take: { from: ["PENDING"], to: "TAKEN", roles: ["WAITER", "MANAGER"] },
  takeout: { from: ["PENDING", "TAKEN"], to: "PAID", roles: ["CASHIER", "MANAGER"] },
  accept: { from: ["PAID"], to: "ACCEPTED", roles: ["KITCHEN", "MANAGER"] },
  cook: { from: ["ACCEPTED"], to: "COOKING", roles: ["KITCHEN", "MANAGER"] },
  ready: { from: ["COOKING"], to: "READY", roles: ["KITCHEN", "MANAGER"] },
  serve: { from: ["READY"], to: "SERVED", roles: ["WAITER", "MANAGER"] },
  complete: { from: ["SERVED"], to: "COMPLETED", roles: ["WAITER", "MANAGER"] },
  cancel: {
    from: ["PENDING", "TAKEN", "PAID", "ACCEPTED", "COOKING"],
    to: "CANCELLED",
    roles: ["WAITER", "CASHIER", "KITCHEN", "MANAGER"],
  },
  void: {
    from: ["PENDING", "TAKEN", "PAID"],
    to: "CANCELLED",
    roles: ["CASHIER", "MANAGER", "OWNER"],
  },
  refund: {
    from: ["PAID", "SERVED", "COMPLETED"],
    to: "CANCELLED",
    roles: ["CASHIER", "MANAGER", "OWNER"],
  },
  "refund-approve": {
    from: ["PAID", "SERVED", "COMPLETED"],
    to: "CANCELLED",
    roles: ["MANAGER", "OWNER"],
  },
  "refund-decline": {
    from: ["PAID", "SERVED", "COMPLETED"],
    to: "CANCELLED",
    roles: ["MANAGER", "OWNER"],
  },
};

const PAYMENT_METHODS: PaymentMethod[] = ["CASH", "CARD", "CARD_ONLINE", "OTHER"];

export async function GET(req: Request, ctx: Ctx) {
  const guard = await requireRoles(req, ["KITCHEN", "WAITER", "CASHIER", "MANAGER", "OWNER"]);
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
  const guard = await requireRoles(req, ["KITCHEN", "WAITER", "CASHIER", "MANAGER", "OWNER"]);
  if ("response" in guard) return guard.response;
  const session = guard.session;
  const { id } = await ctx.params;

  try {
    const { action, collectedAmount, discount, discountReason, paymentMethod, reason } = await req.json();
    const def = ACTIONS[action];
    if (!def) return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    if (!def.roles.includes(session.role))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const order = await prisma.order.findUnique({
      where: { id },
      select: { id: true, restaurantId: true, orderNumber: true, status: true, tableId: true, tableLabel: true, waiterId: true, total: true, refunded: true, refundStatus: true },
    });
    if (!order || order.restaurantId !== session.restaurantId)
      return NextResponse.json({ error: "Order not found" }, { status: 404 });

    if (!def.from.includes(order.status)) {
      return NextResponse.json(
        { error: `Cannot "${action}" an order that is ${order.status}` },
        { status: 409 }
      );
    }

    if (action === "refund" && (order.refunded || order.refundStatus === "REQUESTED")) {
      return NextResponse.json(
        { error: order.refunded ? "Order already refunded" : "Refund already requested — waiting for manager approval" },
        { status: 409 }
      );
    }
    if ((action === "refund-approve" || action === "refund-decline") && order.refundStatus !== "REQUESTED") {
      return NextResponse.json({ error: "No pending refund request for this order" }, { status: 409 });
    }
    if (action === "refund-decline" && order.refunded) {
      return NextResponse.json({ error: "Order already refunded" }, { status: 409 });
    }

    const collected =
      action === "complete" && collectedAmount != null
        ? Math.max(0, Math.round(Number(collectedAmount) * 100) / 100)
        : null;

    if (collected != null && !Number.isFinite(collected))
      return NextResponse.json({ error: "Invalid amount collected" }, { status: 400 });

    let paymentMethodValue: PaymentMethod | null = null;
    if (action === "complete") {
      if (paymentMethod != null && !PAYMENT_METHODS.includes(paymentMethod))
        return NextResponse.json({ error: "Invalid payment method" }, { status: 400 });
      paymentMethodValue = (paymentMethod as PaymentMethod) ?? null;
    }

    const actionReason =
      (action === "void" || action === "refund" || action === "refund-decline") &&
      reason &&
      typeof reason === "string"
        ? reason.trim()
        : null;

    const discountValue =
      action === "complete" && discount != null
        ? Math.max(0, Math.round(Number(discount) * 100) / 100)
        : 0;
    const discountReasonValue =
      action === "complete" && discountReason && typeof discountReason === "string"
        ? discountReason.trim()
        : null;

    const updated = await prisma.$transaction(async (tx) => {
      const full = await tx.order.findUniqueOrThrow({
        where: { id },
        include: { items: true, table: true, receipt: true },
      });

      let takeoutData: Record<string, unknown> = {};
      if (action === "takeout") {
        const subtotal = full.items.reduce((s, i) => s + i.price * i.quantity, 0);
        const tax = Math.round(subtotal * TAX_RATE * 100) / 100;
        const total = Math.round((subtotal + tax) * 100) / 100;
        const items = JSON.stringify(
          full.items.map((i) => ({ name: i.name, price: i.price, quantity: i.quantity }))
        );
        await tx.receipt.upsert({
          where: { orderId: id },
          update: { items, subtotal, discount: 0, tax, total, kitchenId: session.role === "KITCHEN" ? session.id : null },
          create: {
            orderId: id,
            items,
            subtotal,
            discount: 0,
            tax,
            total,
            kitchenId: session.role === "KITCHEN" ? session.id : null,
            restaurantId: full.restaurantId,
          },
        });
        takeoutData = { status: def.to, cashierId: session.id };
      }

      let completeData: Record<string, unknown> = {};
      if (action === "complete") {
        const subtotal = full.items.reduce((s, i) => s + i.price * i.quantity, 0);
        const discount = Math.min(discountValue, subtotal);
        const taxable = Math.max(0, subtotal - discount);
        const tax = Math.round(taxable * TAX_RATE * 100) / 100;
        const net = Math.round((taxable + tax) * 100) / 100;
        const now = new Date();

        await tx.receipt.updateMany({
          where: { orderId: id },
          data: { discount, total: net, paymentMethod: paymentMethodValue, paidAt: now },
        });

        completeData = {
          status: def.to,
          total: net,
          discount,
          discountReason: discountReasonValue,
          paymentMethod: paymentMethodValue,
          paidAt: now,
          ...(collected != null
            ? {
                collectedAmount: collected,
                tip: Math.max(0, Math.round((collected - net) * 100) / 100),
              }
            : {}),
        };
      }

      const statusChange =
        action !== "takeout" &&
        action !== "complete" &&
        action !== "refund" &&
        action !== "refund-decline"
          ? { status: def.to }
          : {};

      const actionFields: Record<string, unknown> = {};
      if (action === "void") {
        actionFields.voided = true;
        actionFields.voidReason = actionReason;
        actionFields.voidedAt = new Date();
        actionFields.voidedBy = session.id;
      } else if (action === "refund") {
        actionFields.refundReason = actionReason;
        actionFields.refundRequestedAt = new Date();
        actionFields.refundRequestedBy = session.id;
        actionFields.refundStatus = "REQUESTED";
      } else if (action === "refund-approve") {
        actionFields.refunded = true;
        actionFields.refundReason = full.refundReason ?? actionReason;
        actionFields.refundedAt = new Date();
        actionFields.refundedBy = session.id;
        actionFields.refundStatus = "APPROVED";
      } else if (action === "refund-decline") {
        actionFields.refundDeniedAt = new Date();
        actionFields.refundDeniedBy = session.id;
        actionFields.refundStatus = "DENIED";
      }

      const updatedOrder = await tx.order.update({
        where: { id },
        data: {
          ...takeoutData,
          ...completeData,
          ...statusChange,
          ...actionFields,
        },
        include: { items: true, table: true, receipt: true },
      });

      if (ITEM_STATUSES.includes(def.to as OrderItemStatus)) {
        await tx.orderItem.updateMany({
          where: { orderId: id },
          data: { status: def.to as OrderItemStatus },
        });
      }

      if (
        ["accept", "cook", "ready"].includes(action) &&
        session.role === "KITCHEN"
      ) {
        await tx.receipt.updateMany({
          where: { orderId: id },
          data: { kitchenId: session.id },
        });
      }

      if (
        ["complete", "cancel", "void", "refund-approve"].includes(action) &&
        full.tableId
      ) {
        const otherActive = await tx.order.count({
          where: {
            tableId: full.tableId,
            status: { in: ["PENDING", "TAKEN", "PAID", "ACCEPTED", "COOKING", "READY", "SERVED"] },
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
    invalidateCache(`^cashier-orders:${escapeRegExp(restaurantId)}$`);
    invalidateCache(`^notifs:.*:${escapeRegExp(restaurantId)}$`);
    invalidateCache(`^stats:${escapeRegExp(restaurantId)}$`);

    if (["complete", "cancel", "void", "refund-approve"].includes(action)) {
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

        if (action === "complete") {
          await persistEvent(
            { scope: "restaurant", restaurantId },
            "ORDER_PAYMENT",
            {
              orderId: id,
              orderNumber: updated.orderNumber,
              by: session.name,
              byId: session.id,
              tableLabel: updated.tableLabel,
              subtotal: updated.receipt?.subtotal,
              discount: updated.discount,
              discountReason: updated.discountReason,
              paymentMethod: updated.paymentMethod,
              paidAt: updated.paidAt?.toISOString(),
              total: updated.total,
              collected: updated.collectedAmount ?? null,
              tip: updated.tip ?? null,
            }
          );
        } else if (action === "void") {
          await persistEvent(
            { scope: "restaurant", restaurantId },
            "ORDER_VOIDED",
            {
              orderId: id,
              orderNumber: updated.orderNumber,
              by: session.name,
              byId: session.id,
              reason: updated.voidReason ?? null,
              amount: updated.receipt?.total ?? updated.total,
              voidedAt: updated.voidedAt?.toISOString(),
              tableLabel: updated.tableLabel,
            }
          );
        } else if (action === "refund") {
          await persistEvent(
            { scope: "restaurant", restaurantId },
            "ORDER_REFUND_REQUESTED",
            {
              orderId: id,
              orderNumber: updated.orderNumber,
              by: session.name,
              byId: session.id,
              reason: updated.refundReason ?? null,
              amount: updated.receipt?.total ?? updated.total,
              paymentMethod: updated.paymentMethod,
              requestedAt: updated.refundRequestedAt?.toISOString(),
              tableLabel: updated.tableLabel,
            }
          );
        } else if (action === "refund-approve") {
          await persistEvent(
            { scope: "restaurant", restaurantId },
            "ORDER_REFUND_APPROVED",
            {
              orderId: id,
              orderNumber: updated.orderNumber,
              by: session.name,
              byId: session.id,
              reason: updated.refundReason ?? null,
              amount: updated.receipt?.total ?? updated.total,
              paymentMethod: updated.paymentMethod,
              approvedAt: updated.refundedAt?.toISOString(),
              tableLabel: updated.tableLabel,
            }
          );
        } else if (action === "refund-decline") {
          await persistEvent(
            { scope: "restaurant", restaurantId },
            "ORDER_REFUND_DENIED",
            {
              orderId: id,
              orderNumber: updated.orderNumber,
              by: session.name,
              byId: session.id,
              reason: updated.refundDeniedAt ? actionReason ?? null : null,
              amount: updated.receipt?.total ?? updated.total,
              deniedAt: updated.refundDeniedAt?.toISOString(),
              tableLabel: updated.tableLabel,
            }
          );
        }

        if (action === "takeout") {
          const receipt = await prisma.receipt.findUnique({ where: { orderId: id } });
          await notify({
            role: "KITCHEN",
            restaurantId,
            type: "ORDER_NEW",
            title: `${summary} checkout — ready to cook`,
            body: `${updated.tableLabel} — total ${receipt?.total.toFixed(2) ?? updated.total.toFixed(2)} ETB`,
            orderId: id,
            tableId: updated.tableId ?? undefined,
          });
          if (tableCode) {
            await emitToTable(tableCode, "ORDER_UPDATE", {
              id,
              orderNumber: updated.orderNumber,
              status: "PAID",
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
        } else if (action === "ready") {
          const receipt = await prisma.receipt.findUnique({ where: { orderId: id } });
          if (updated.waiterId) {
            await notify({
              userId: updated.waiterId,
              restaurantId,
              type: "ORDER_READY",
              title: `${summary} is ready`,
              body: `Ready for delivery — total ${receipt?.total.toFixed(2) ?? updated.total.toFixed(2)} ETB`,
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

        if (action === "take") {
          await notify({
            role: "CASHIER",
            restaurantId,
            type: "ORDER_NEW",
            title: `${summary} taken — take it out`,
            body: `${updated.tableLabel} is ready for checkout. Generate the receipt to send it to the kitchen.`,
            orderId: id,
            tableId: updated.tableId ?? undefined,
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
