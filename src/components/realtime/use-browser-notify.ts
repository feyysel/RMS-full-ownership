"use client";

import * as React from "react";

export type BrowserNotifyPermission = "granted" | "denied" | "default" | "unsupported";

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

  const requestPermission = React.useCallback(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    Notification.requestPermission()
      .then((p) => setPermission(p as BrowserNotifyPermission))
      .catch(() => {});
  }, []);

  return { permission, notifyBrowser, requestPermission };
}
