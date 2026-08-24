"use client";

import * as React from "react";

export type RealtimeChannel =
  | { scope: "restaurant"; id: string }
  | { scope: "user"; id: string }
  | { scope: "table"; code: string }
  | { scope: "owner" };

export type RealtimeEvent<T = unknown> = {
  id: string;
  channel: RealtimeChannel;
  type: string;
  payload: T;
  createdAt: number;
};

type PollEvent = {
  id: string;
  scope: "restaurant" | "user" | "table" | "owner";
  scopeId: string | null;
  type: string;
  payload: unknown;
  createdAt: string;
};

const POLL_INTERVAL = 3000;

function toChannel(evt: PollEvent): RealtimeChannel {
  if (evt.scope === "restaurant")
    return { scope: "restaurant", id: evt.scopeId ?? "" };
  if (evt.scope === "user") return { scope: "user", id: evt.scopeId ?? "" };
  if (evt.scope === "table") return { scope: "table", code: evt.scopeId ?? "" };
  return { scope: "owner" };
}

export function useRealtime(
  channels: RealtimeChannel[],
  onEvent?: (event: RealtimeEvent) => void
) {
  const [connected, setConnected] = React.useState(false);
  const [lastEvent, setLastEvent] = React.useState<RealtimeEvent | null>(null);
  const handlerRef = React.useRef(onEvent);

  React.useEffect(() => {
    handlerRef.current = onEvent;
  });

  const channelKey = channels
    .map((c) =>
      c.scope === "restaurant" || c.scope === "user"
        ? `${c.scope}:${c.id}`
        : c.scope === "table"
          ? `table:${c.code}`
          : "owner"
    )
    .join("|");

  React.useEffect(() => {
    if (channels.length === 0) return;

    const params = new URLSearchParams();
    const scopes = new Set(channels.map((c) => c.scope));
    if (scopes.has("owner")) params.set("owner", "1");
    if (scopes.has("table")) {
      const code = channels.find((c) => c.scope === "table")?.code;
      if (code) params.set("table", code);
    }
    if (scopes.has("user")) {
      const id = channels.find((c) => c.scope === "user")?.id;
      if (id) params.set("user", id);
    }
    if (scopes.has("restaurant")) {
      const id = channels.find((c) => c.scope === "restaurant")?.id;
      if (id) params.set("restaurant", id);
    }

    let cancelled = false;
    let since = new Date(Date.now() - 1000).toISOString();
    const seen = new Set<string>();

    let interval: ReturnType<typeof setInterval> | undefined;

    async function poll() {
      try {
        params.set("since", since);
        const res = await fetch(`/api/events?${params.toString()}`);
        if (!res.ok) {
          setConnected(false);
          return;
        }
        const data = (await res.json()) as {
          now: string;
          events: PollEvent[];
        };
        setConnected(true);
        since = data.now;

        for (const raw of data.events) {
          if (cancelled || seen.has(raw.id)) continue;
          seen.add(raw.id);
          const evt: RealtimeEvent = {
            id: raw.id,
            channel: toChannel(raw),
            type: raw.type,
            payload: raw.payload,
            createdAt: Date.parse(raw.createdAt),
          };
          setLastEvent(evt);
          handlerRef.current?.(evt);
        }
      } catch {
        setConnected(false);
      }
    }

    function start() {
      if (interval) return;
      poll();
      interval = setInterval(poll, POLL_INTERVAL);
    }

    function stop() {
      if (interval) {
        clearInterval(interval);
        interval = undefined;
      }
    }

    function onVisibility() {
      if (document.hidden) {
        stop();
      } else {
        start();
      }
    }

    document.addEventListener("visibilitychange", onVisibility);
    if (!document.hidden) start();

    return () => {
      cancelled = true;
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelKey]);

  return { connected, lastEvent };
}
