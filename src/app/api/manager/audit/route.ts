import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AUDIT_TYPES = [
  "ORDER_PAYMENT",
  "ORDER_VOIDED",
  "ORDER_REFUND_REQUESTED",
  "ORDER_REFUND_APPROVED",
  "ORDER_REFUND_DENIED",
];

const TYPE_LABEL: Record<string, string> = {
  ORDER_PAYMENT: "Payment",
  ORDER_VOIDED: "Void",
  ORDER_REFUND_REQUESTED: "Refund requested",
  ORDER_REFUND_APPROVED: "Refund approved",
  ORDER_REFUND_DENIED: "Refund denied",
};

export async function GET(req: Request) {
  const guard = await requireRoles(req, ["MANAGER", "OWNER"]);
  if ("response" in guard) return guard.response;
  const session = guard.session;
  if (!session.restaurantId)
    return NextResponse.json({ error: "No restaurant assigned" }, { status: 400 });

  const daysParam = new URL(req.url).searchParams.get("days");
  const days = daysParam ? Math.max(1, Math.min(90, Number(daysParam) || 30)) : 30;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const rows = await prisma.eventLog.findMany({
    where: {
      scope: "restaurant",
      scopeId: session.restaurantId,
      type: { in: AUDIT_TYPES },
      createdAt: { gte: since },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json({
    events: rows.map((e) => {
      const p = (e.payload ?? {}) as Record<string, unknown>;
      return {
        id: e.id,
        type: e.type,
        label: TYPE_LABEL[e.type] ?? e.type,
        createdAt: e.createdAt.toISOString(),
        actor: typeof p.by === "string" ? p.by : null,
        actorId: typeof p.byId === "string" ? p.byId : null,
        orderNumber: typeof p.orderNumber === "number" ? p.orderNumber : null,
        orderId: typeof p.orderId === "string" ? p.orderId : null,
        tableLabel: typeof p.tableLabel === "string" ? p.tableLabel : null,
        amount: typeof p.amount === "number" ? p.amount : typeof p.total === "number" ? p.total : null,
        paymentMethod: typeof p.paymentMethod === "string" ? p.paymentMethod : null,
        reason: typeof p.reason === "string" ? p.reason : null,
        detail: p,
      };
    }),
  });
}
