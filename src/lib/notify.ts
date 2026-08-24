import type { Role } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { persistEvent, type Channel } from "@/lib/realtime";

type NotifyInput = {
  userId?: string;
  role?: Role;
  restaurantId?: string | null;
  type: string;
  title: string;
  body: string;
  orderId?: string;
  tableId?: string;
};

export async function notify(input: NotifyInput) {
  const { userId, role, restaurantId, ...rest } = input;

  const notif = await prisma.notification.create({
    data: {
      userId: userId ?? null,
      role: role ?? null,
      restaurantId: restaurantId ?? null,
      ...rest,
    },
  });

  const channel: Channel | null = userId
    ? { scope: "user", userId }
    : restaurantId
      ? { scope: "restaurant", restaurantId }
      : null;

  if (channel) {
    await persistEvent(channel, input.type, {
      id: notif.id,
      title: notif.title,
      body: notif.body,
      type: notif.type,
      orderId: notif.orderId ?? null,
      tableId: notif.tableId ?? null,
      createdAt: notif.createdAt.toISOString(),
    });
  }

  return notif;
}

export async function emitToTable(
  code: string,
  type: string,
  payload: unknown
) {
  await persistEvent({ scope: "table", code }, type, payload);
}

export async function emitOwner(type: string, payload: unknown) {
  await persistEvent({ scope: "owner" }, type, payload);
}
