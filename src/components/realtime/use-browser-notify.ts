"use client";

import * as React from "react";

export type BrowserNotifyPermission = "granted" | "denied" | "default" | "unsupported";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

let swRegistration: ServiceWorkerRegistration | null = null;

async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  if (swRegistration) return swRegistration;
  try {
    swRegistration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    return swRegistration;
  } catch {
    return null;
  }
}

async function subscribePush(reg: ServiceWorkerRegistration): Promise<PushSubscription | null> {
  try {
    const existing = await reg.pushManager.getSubscription();
    if (existing) return existing;

    const res = await fetch("/api/push/vapid-public-key");
    if (!res.ok) return null;
    const { publicKey } = await res.json();
    if (!publicKey) return null;

    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });

    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: subscription.endpoint,
        p256dh: subscription.toJSON().keys?.p256dh ?? "",
        auth: subscription.toJSON().keys?.auth ?? "",
      }),
    });

    return subscription;
  } catch {
    return null;
  }
}

async function unsubscribePush(reg: ServiceWorkerRegistration) {
  try {
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    await fetch("/api/push/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    });
    await sub.unsubscribe();
  } catch {
    /* ignore */
  }
}

export function useBrowserNotify() {
  const [permission, setPermission] = React.useState<BrowserNotifyPermission>("unsupported");

  React.useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    let cancelled = false;
    (async () => {
      let p = Notification.permission;
      if (p === "default") {
        try {
          p = await Notification.requestPermission();
        } catch {
          return;
        }
      }
      if (!cancelled) setPermission(p as BrowserNotifyPermission);

      if (p === "granted") {
        const reg = await registerServiceWorker();
        if (reg && !cancelled) {
          await subscribePush(reg);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const notifyBrowser = React.useCallback(
    (title: string, opts?: { body?: string; tag?: string }) => {
      if (permission !== "granted" || typeof window === "undefined") return;
      if (document.hasFocus() && !document.hidden) return;
      try {
        const n = new Notification(title, {
          body: opts?.body,
          tag: opts?.tag,
        });
        n.onclick = () => {
          window.focus();
          n.close();
        };
      } catch {
        /* notification unavailable */
      }
    },
    [permission]
  );

  const requestPermission = React.useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const p = await Notification.requestPermission();
    setPermission(p as BrowserNotifyPermission);
    if (p === "granted") {
      const reg = await registerServiceWorker();
      if (reg) await subscribePush(reg);
    }
  }, []);

  const unsubscribeAll = React.useCallback(async () => {
    if (swRegistration) {
      await unsubscribePush(swRegistration);
      swRegistration = null;
    }
  }, []);

  return { permission, notifyBrowser, requestPermission, unsubscribeAll };
}
