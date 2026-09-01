import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PERIODS = ["day", "week", "month"] as const;
type Period = (typeof PERIODS)[number];

function periodStart(period: Period): Date {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (period === "day") return start;
  if (period === "week") {
    const day = start.getDay() || 7;
    start.setDate(start.getDate() - day + 1);
    return start;
  }
  start.setDate(1);
  return start;
}

export async function GET(req: Request) {
  const guard = await requireRoles(req, ["MANAGER", "OWNER"]);
  if ("response" in guard) return guard.response;
  const session = guard.session;
  if (!session.restaurantId)
    return NextResponse.json({ error: "No restaurant assigned" }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("period");
  const period: Period = PERIODS.includes(raw as Period) ? (raw as Period) : "day";
  const since = periodStart(period);

  const [kitchenUsers, orders] = await Promise.all([
    prisma.user.findMany({
      where: {
        restaurantId: session.restaurantId,
        role: "KITCHEN",
        isActive: true,
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.order.findMany({
      where: {
        restaurantId: session.restaurantId,
        status: { notIn: ["CANCELLED", "PENDING"] },
        voided: false,
        refunded: false,
        createdAt: { gte: since },
        receipt: { isNot: null },
      },
      select: {
        receipt: {
          select: { kitchenId: true },
          where: { kitchenId: { not: null } },
        },
        items: { select: { name: true, quantity: true } },
      },
    }),
  ]);

  const stats = new Map<
    string,
    { id: string; name: string; orders: number; dishes: number; items: Map<string, number> }
  >();

  for (const u of kitchenUsers) {
    stats.set(u.id, { id: u.id, name: u.name, orders: 0, dishes: 0, items: new Map() });
  }

  for (const o of orders) {
    const kitchenId = o.receipt?.kitchenId;
    if (!kitchenId || !stats.has(kitchenId)) continue;
    const row = stats.get(kitchenId)!;
    row.orders += 1;
    for (const item of o.items) {
      row.dishes += item.quantity;
      row.items.set(item.name, (row.items.get(item.name) ?? 0) + item.quantity);
    }
  }

  const rows = Array.from(stats.values())
    .map((s) => ({
      id: s.id,
      name: s.name,
      orders: s.orders,
      dishes: s.dishes,
      items: Array.from(s.items.entries())
        .map(([name, quantity]) => ({ name, quantity }))
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 10),
    }))
    .sort((a, b) => b.dishes - a.dishes || a.name.localeCompare(b.name));

  const summary = rows.reduce(
    (acc, r) => {
      acc.orders += r.orders;
      acc.dishes += r.dishes;
      return acc;
    },
    { orders: 0, dishes: 0 }
  );

  return NextResponse.json({
    period,
    since: since.toISOString(),
    summary,
    kitchen: rows,
  });
}
