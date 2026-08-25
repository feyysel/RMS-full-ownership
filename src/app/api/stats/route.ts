import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/guard";
import { getCached, setCached } from "@/lib/cache";

const STATS_TTL = 10_000;

export const runtime = "nodejs";

export async function GET(req: Request) {
  const guard = await requireRoles(req, ["OWNER", "MANAGER", "KITCHEN", "WAITER"]);
  if ("response" in guard) return guard.response;
  const session = guard.session;
  if (!session.restaurantId)
    return NextResponse.json({ error: "No restaurant assigned" }, { status: 400 });

  const rid = session.restaurantId;
  const cacheKey = `stats:${rid}`;
  const cached = getCached<unknown>(cacheKey);
  if (cached) return NextResponse.json(cached);

  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const sevenDaysAgo = new Date(startOfDay);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

  const [
    revenueToday,
    ordersToday,
    totalOrders,
    orderCounts,
    ordersByStatus,
    activeTables,
    employeeCount,
    menuCount,
    recentOrders,
    trendOrders,
    topItems,
  ] = await Promise.all([
    prisma.order.aggregate({
      _sum: { total: true },
      where: { restaurantId: rid, createdAt: { gte: startOfDay }, status: { notIn: ["CANCELLED"] } },
    }),
    prisma.order.count({
      where: { restaurantId: rid, createdAt: { gte: startOfDay }, status: { notIn: ["CANCELLED"] } },
    }),
    prisma.order.count({ where: { restaurantId: rid } }),
    prisma.order.groupBy({
      by: ["status"],
      where: { restaurantId: rid },
      _count: true,
    }),
    prisma.order.groupBy({
      by: ["status"],
      where: { restaurantId: rid, createdAt: { gte: startOfDay } },
      _count: true,
    }),
    prisma.table.count({ where: { restaurantId: rid, status: "occupied" } }),
    prisma.user.count({
      where: { restaurantId: rid, role: { in: ["KITCHEN", "WAITER"] } },
    }),
    prisma.menuItem.count({ where: { restaurantId: rid, available: true } }),
    prisma.order.findMany({
      where: { restaurantId: rid },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { items: { select: { name: true, quantity: true } }, table: { select: { number: true } }, waiter: { select: { name: true } } },
    }),
    prisma.order.findMany({
      where: { restaurantId: rid, createdAt: { gte: sevenDaysAgo }, status: { notIn: ["CANCELLED"] } },
      select: { createdAt: true, total: true },
    }),
    prisma.orderItem.groupBy({
      by: ["name"],
      where: { order: { restaurantId: rid, status: { notIn: ["CANCELLED"] } } },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 5,
    }),
  ]);

  const dayLabels: string[] = [];
  const dayRevenue: number[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(sevenDaysAgo);
    d.setDate(d.getDate() + i);
    dayLabels.push(d.toLocaleDateString("en-US", { weekday: "short" }));
    const dayTotal = trendOrders
      .filter((o) => new Date(o.createdAt).toDateString() === d.toDateString())
      .reduce((s, o) => s + o.total, 0);
    dayRevenue.push(Math.round(dayTotal * 100) / 100);
  }

  const result = {
    stats: {
      revenueToday: revenueToday._sum.total ?? 0,
      ordersToday,
      totalOrders,
      activeTables,
      employeeCount,
      menuCount,
      openOrders:
        orderCounts
          .filter((g) => ["PENDING", "ACCEPTED", "COOKING", "READY", "SERVED"].includes(g.status))
          .reduce((s, g) => s + g._count, 0) ?? 0,
    },
    ordersByStatus,
    recentOrders,
    topItems: topItems.map((t) => ({ name: t.name, qty: t._sum.quantity ?? 0 })),
    trend: { labels: dayLabels, revenue: dayRevenue },
  };

  setCached(cacheKey, result, STATS_TTL);
  return NextResponse.json(result);
}
