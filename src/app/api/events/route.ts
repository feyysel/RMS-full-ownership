import { prisma } from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/session";
import { subscribeEvents, broadcastEvent } from "@/lib/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const isSSE = url.searchParams.get("sse") === "1";

  if (isSSE) {
    return handleSSE(req);
  }

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
      select: {
        id: true,
        scope: true,
        scopeId: true,
        type: true,
        payload: true,
        createdAt: true,
      },
    });

    return Response.json({
      now: new Date(now).toISOString(),
      events: rows.map((e) => ({
        id: e.id,
        scope: e.scope,
        scopeId: e.scopeId,
        type: e.type,
        payload: e.payload,
        createdAt: e.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error("events poll error", err);
    return Response.json({ error: "Something went wrong" }, { status: 500 });
  }
}

function buildChannelKey(req: Request): string {
  const url = new URL(req.url);
  const parts: string[] = [];
  if (url.searchParams.get("owner")) parts.push("owner");
  if (url.searchParams.get("restaurant")) parts.push(`r:${url.searchParams.get("restaurant")}`);
  if (url.searchParams.get("user")) parts.push(`u:${url.searchParams.get("user")}`);
  if (url.searchParams.get("table")) parts.push(`t:${url.searchParams.get("table")}`);
  return parts.sort().join("|");
}

function handleSSE(req: Request) {
  const channelKey = buildChannelKey(req);

  const encoder = new TextEncoder();
  let cancelled = false;
  let keepAliveTimer: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: string) => {
        if (cancelled) return;
        try {
          controller.enqueue(encoder.encode(data));
        } catch {}
      };

      send(`data: ${JSON.stringify({ type: "connected", channelKey })}\n\n`);

      keepAliveTimer = setInterval(() => {
        send(`: keepalive ${Date.now()}\n\n`);
      }, 15_000);

      const unsubscribe = subscribeEvents(channelKey, (event: unknown) => {
        send(`data: ${JSON.stringify(event)}\n\n`);
      });

      req.signal.addEventListener("abort", () => {
        cancelled = true;
        if (keepAliveTimer) clearInterval(keepAliveTimer);
        unsubscribe();
        try {
          controller.close();
        } catch {}
      });
    },
    cancel() {
      cancelled = true;
      if (keepAliveTimer) clearInterval(keepAliveTimer);
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
