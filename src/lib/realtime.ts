import { prisma } from "@/lib/prisma";

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

export async function persistEvent(
  channel: Channel,
  type: string,
  payload: unknown
) {
  try {
    await prisma.eventLog.create({
      data: {
        scope: channel.scope,
        scopeId: scopeIdFor(channel),
        type,
        ...(payload == null ? {} : { payload: payload as object }),
      },
    });

    if (Math.random() < 0.002) {
      const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      await prisma.eventLog.deleteMany({ where: { createdAt: { lt: cutoff } } });
    }
  } catch (err) {
    console.error("persistEvent failed", err);
  }
}
