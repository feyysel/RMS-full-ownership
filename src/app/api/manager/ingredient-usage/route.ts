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

function normalize(name: string): string {
  return name.trim().toLowerCase();
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

  const items = await prisma.orderItem.findMany({
    where: {
      order: {
        restaurantId: session.restaurantId,
        status: { notIn: ["CANCELLED", "PENDING"] },
        voided: false,
        refunded: false,
        createdAt: { gte: since },
      },
    },
    select: {
      quantity: true,
      menuItem: { select: { ingredients: true, name: true } },
    },
  });

  const usage = new Map<string, { name: string; quantities: number; dishes: number }>();
  let servingCount = 0;

  for (const item of items) {
    const ingredients = item.menuItem?.ingredients ?? "";
    const qty = item.quantity;
    servingCount += qty;
    const rawList = ingredients
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    for (const rawIng of rawList) {
      const key = normalize(rawIng);
      if (!usage.has(key)) usage.set(key, { name: rawIng, quantities: 0, dishes: 0 });
      const entry = usage.get(key)!;
      entry.quantities += qty;
      entry.dishes += 1;
    }
  }

  const rows = Array.from(usage.values())
    .map((r) => ({
      name: r.name,
      quantities: r.quantities,
      share: servingCount > 0 ? Math.round((r.dishes / servingCount) * 100) : 0,
    }))
    .sort((a, b) => b.quantities - a.quantities || a.name.localeCompare(b.name));

  return NextResponse.json({
    period,
    since: since.toISOString(),
    servingCount,
    ingredients: rows,
  });
}
