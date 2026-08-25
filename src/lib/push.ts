import webpush from "web-push";
import { prisma } from "@/lib/prisma";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@restaurant-system.com";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

export function getVapidPublicKey() {
  return VAPID_PUBLIC_KEY ?? null;
}

type PushPayload = {
  title: string;
  body: string;
  tag?: string;
  url?: string;
};

export async function sendPushToUser(userId: string, payload: PushPayload) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return;

  const subs = await prisma.pushSubscription.findMany({
    where: { userId },
  });

  await sendPushToSubscriptions(subs, payload);
}

export async function sendPushToRole(
  role: string,
  restaurantId: string | null,
  payload: PushPayload
) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return;

  const where = {
    user: {
      role: role as "OWNER" | "MANAGER" | "KITCHEN" | "WAITER",
      isActive: true,
      ...(restaurantId ? { restaurantId } : {}),
    },
  };

  const subs = await prisma.pushSubscription.findMany({ where });

  await sendPushToSubscriptions(subs, payload);
}

async function sendPushToSubscriptions(
  subs: { id: string; endpoint: string; p256dh: string; auth: string }[],
  payload: PushPayload
) {
  const failedIds: string[] = [];

  const results = await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify(payload)
        );
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          failedIds.push(sub.id);
        }
      }
    })
  );

  if (failedIds.length > 0) {
    await prisma.pushSubscription.deleteMany({
      where: { id: { in: failedIds } },
    });
  }

  return results;
}
