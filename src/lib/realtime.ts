import { prisma } from "@/lib/prisma";
import { broadcastEvent } from "@/lib/cache";

export type Channel =
  | { scope: "restaurant"; restaurantId: string }
  | { scope: "user"; userId: string }
  | { scope: "table"; code: string }
  | { scope: "owner" };

function scopeIdFor(channel: Channel): string | null {
  switch (channel.scope) {
    case "restaurant":
      return channel.restaurantId;
    case "user":
      return channel.userId;
    case "table":
      return channel.code;
    case "owner":
      return null;
  }
}

function channelKeyFor(channel: Channel): string {
  switch (channel.scope) {
    case "restaurant":
      return `r:${channel.restaurantId}`;
    case "user":
      return `u:${channel.userId}`;
    case "table":
      return `t:${channel.code}`;
    case "owner":
      return "owner";
  }
}

export async function persistEvent(
  channel: Channel,
  type: string,
  payload: unknown
) {
  try {
    const event = await prisma.eventLog.create({
      data: {
        scope: channel.scope,
        scopeId: scopeIdFor(channel),
        type,
        ...(payload == null ? {} : { payload: payload as object }),
      },
      select: {
        id: true,
        scope: true,
        scopeId: true,
        type: true,
        payload: true,
        createdAt: true,
      },
    });

    const ssePayload = {
      id: event.id,
      scope: event.scope,
      scopeId: event.scopeId,
      type: event.type,
      payload: event.payload,
      createdAt: event.createdAt.toISOString(),
    };

    broadcastEvent(channelKeyFor(channel), ssePayload);

    if (channel.scope !== "owner" && channel.scope !== "table") {
      broadcastEvent("owner", ssePayload);
    }

    if (Math.random() < 0.005) {
      const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      await prisma.eventLog.deleteMany({ where: { createdAt: { lt: cutoff } } });
    }
  } catch (err) {
    console.error("persistEvent failed", err);
  }
}
