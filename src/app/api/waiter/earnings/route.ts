import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/guard";

export const runtime = "nodejs";

const r2 = (n: number) => Math.round(n * 100) / 100;

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfWeekMonday(d: Date) {
  const x = startOfDay(d);
  const daysSinceMonday = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - daysSinceMonday);
  return x;
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

type Totals = {
  served: number;
  sales: number;
  collected: number;
  tips: number;
};

export async function GET(req: Request) {
  const guard = await requireRoles(req, ["WAITER"]);
  if ("response" in guard) return guard.response;
  const session = guard.session;
  if (!session.restaurantId)
    return NextResponse.json({ error: "No restaurant assigned" }, { status: 400 });

  const now = new Date();
  const todayStart = startOfDay(now);
  const weekStart = startOfWeekMonday(now);
  const weekEnd = addDays(weekStart, 7);

  const orders = await prisma.order.findMany({
    where: {
      restaurantId: session.restaurantId,
      waiterId: session.id,
      status: { in: ["SERVED", "COMPLETED"] },
      createdAt: { gte: weekStart, lt: weekEnd },
    },
    include: { receipt: true },
    orderBy: { createdAt: "asc" },
  });

  const enrich = (o: (typeof orders)[number]) => {
    const payable = o.receipt?.total ?? o.total;
    const collected = o.collectedAmount;
    const tip =
      o.tip ??
      (collected != null ? Math.max(0, r2(collected - payable)) : 0);
    return { payable, collected, tip };
  };

  const empty = (): Totals => ({ served: 0, sales: 0, collected: 0, tips: 0 });
  const today: Totals = empty();
  const week: Totals = empty();
  const byDay = new Map<string, { date: Date; totals: Totals }>();

  for (const o of orders) {
    const { payable, collected, tip } = enrich(o);
    week.served += 1;
    week.sales = r2(week.sales + payable);
    if (collected != null) week.collected = r2(week.collected + collected);
    week.tips = r2(week.tips + tip);

    const dayStart = startOfDay(o.createdAt);
    const key = dayStart.toISOString();
    if (!byDay.has(key)) byDay.set(key, { date: dayStart, totals: empty() });
    const row = byDay.get(key)!.totals;
    row.served += 1;
    row.sales = r2(row.sales + payable);
    if (collected != null) row.collected = r2(row.collected + collected);
    row.tips = r2(row.tips + tip);

    if (o.createdAt >= todayStart && o.createdAt < addDays(todayStart, 1)) {
      today.served += 1;
      today.sales = r2(today.sales + payable);
      if (collected != null) today.collected = r2(today.collected + collected);
      today.tips = r2(today.tips + tip);
    }
  }

  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    const t = byDay.get(date.toISOString())?.totals ?? empty();
    return { date: date.toISOString(), isToday: date.getTime() === todayStart.getTime(), ...t };
  });

  const recent = [...orders].reverse().slice(0, 50).map((o) => {
    const { payable, collected, tip } = enrich(o);
    return {
      id: o.id,
      orderNumber: o.orderNumber,
      tableLabel: o.tableLabel,
      status: o.status,
      total: o.total,
      payable,
      collectedAmount: collected,
      tip,
      createdAt: o.createdAt.toISOString(),
    };
  });

  return NextResponse.json({
    today: { date: todayStart.toISOString(), ...today },
    week: { from: weekStart.toISOString(), to: addDays(weekStart, 6).toISOString(), ...week },
    days,
    orders: recent,
  });
}
