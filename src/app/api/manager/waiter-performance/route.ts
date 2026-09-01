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

const r2 = (n: number) => Math.round(n * 100) / 100;

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

  const [waiters, orders] = await Promise.all([
    prisma.user.findMany({
      where: {
        restaurantId: session.restaurantId,
        role: "WAITER",
        isActive: true,
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.order.findMany({
      where: {
        restaurantId: session.restaurantId,
        waiterId: { not: null },
        status: { in: ["SERVED", "COMPLETED"] },
        voided: false,
        refunded: false,
        createdAt: { gte: since },
      },
      select: {
        waiterId: true,
        total: true,
        collectedAmount: true,
        tip: true,
        receipt: { select: { total: true } },
      },
    }),
  ]);

  const totals = new Map<
    string,
    { id: string; name: string; orders: number; sales: number; collected: number; tips: number }
  >();

  for (const w of waiters) {
    totals.set(w.id, { id: w.id, name: w.name, orders: 0, sales: 0, collected: 0, tips: 0 });
  }

  for (const o of orders) {
    if (!o.waiterId) continue;
    const row = totals.get(o.waiterId);
    if (!row) continue;
    const payable = o.receipt?.total ?? o.total;
    const collected = o.collectedAmount;
    const tip = o.tip ?? (collected != null ? Math.max(0, r2(collected - payable)) : 0);
    row.orders += 1;
    row.sales = r2(row.sales + payable);
    if (collected != null) row.collected = r2(row.collected + collected);
    row.tips = r2(row.tips + tip);
  }

  const rows = Array.from(totals.values()).sort(
    (a, b) => b.sales - a.sales || b.orders - a.orders || a.name.localeCompare(b.name)
  );

  const summary = rows.reduce(
    (acc, r) => {
      acc.orders += r.orders;
      acc.sales = r2(acc.sales + r.sales);
      acc.collected = r2(acc.collected + r.collected);
      acc.tips = r2(acc.tips + r.tips);
      return acc;
    },
    { orders: 0, sales: 0, collected: 0, tips: 0 }
  );

  return NextResponse.json({
    period,
    since: since.toISOString(),
    summary,
    waiters: rows,
  });
}
