import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);

  const sinceParam = url.searchParams.get("since");
  const since = sinceParam ? new Date(sinceParam).getTime() : Date.now() - 1000;
  const now = Date.now();
  const lowerBound = new Date(now - 5 * 60 * 1000);
  const sinceDate = new Date(Math.max(Number.isFinite(since) ? since : now - 1000, lowerBound.getTime()));

  const or: Record<string, unknown>[] = [];
  if (url.searchParams.get("owner")) or.push({ scope: "owner" });
  const userId = url.searchParams.get("user");
  if (userId) or.push({ scope: "user", scopeId: userId });
  const restaurantId = url.searchParams.get("restaurant");
  if (restaurantId) or.push({ scope: "restaurant", scopeId: restaurantId });
  const code = url.searchParams.get("table");
  if (code) or.push({ scope: "table", scopeId: code });

  try {
    if (or.length === 0) {
      return Response.json({ now: new Date(now).toISOString(), events: [] });
    }

    const rows = await prisma.eventLog.findMany({
      where: {
        createdAt: { gt: sinceDate },
        OR: or,
      },
      orderBy: { createdAt: "asc" },
      take: 100,
    });

    const events = rows.map((e) => ({
      id: e.id,
      scope: e.scope,
      scopeId: e.scopeId,
      type: e.type,
      payload: e.payload,
      createdAt: e.createdAt.toISOString(),
    }));

    return Response.json({
      now: new Date(now).toISOString(),
      events,
    });
  } catch (err) {
    console.error("events poll error", err);
    return Response.json({ error: "Something went wrong" }, { status: 500 });
  }
}
