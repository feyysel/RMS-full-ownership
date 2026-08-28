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

export function persistEvent(
  channel: Channel,
  type: string,
  payload: unknown
) {
  const ssePayload = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    scope: channel.scope,
    scopeId: scopeIdFor(channel),
    type,
    payload: payload ?? null,
    createdAt: new Date().toISOString(),
  };

  broadcastEvent(channelKeyFor(channel), ssePayload);

  if (channel.scope !== "owner" && channel.scope !== "table") {
    broadcastEvent("owner", ssePayload);
  }

  prisma.eventLog
    .create({
      data: {
        scope: channel.scope,
        scopeId: scopeIdFor(channel),
        type,
        ...(payload == null ? {} : { payload: payload as object }),
      },
      select: { id: true },
    })
    .catch((err) => {
      console.error("persistEvent DB write failed", err);
    });

  scheduleRetentionCleanup();
}

let retentionCleanupScheduled = false;

function scheduleRetentionCleanup(): void {
  if (
    retentionCleanupScheduled ||
    typeof setInterval === "undefined"
  ) {
    return;
  }
  retentionCleanupScheduled = true;
  setInterval(async () => {
    try {
      const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      await prisma.eventLog.deleteMany({
        where: { createdAt: { lt: cutoff } },
      });
    } catch (err) {
      console.error("eventLog retention cleanup failed", err);
    }
  }, 6 * 60 * 60 * 1000);
}
