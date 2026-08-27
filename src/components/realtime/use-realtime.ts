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

const POLL_INTERVAL_BASE = 1000;
const POLL_INTERVAL_MAX = 10000;
const SSE_RECONNECT_DELAY = 2000;
const SSE_RECONNECT_MAX = 30000;

function toChannel(evt: PollEvent): RealtimeChannel {
  if (evt.scope === "restaurant")
    return { scope: "restaurant", id: evt.scopeId ?? "" };
  if (evt.scope === "user") return { scope: "user", id: evt.scopeId ?? "" };
  if (evt.scope === "table") return { scope: "table", code: evt.scopeId ?? "" };
  return { scope: "owner" };
}

function buildParams(channels: RealtimeChannel[]): URLSearchParams {
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
  return params;
}

function useSSE(
  channels: RealtimeChannel[],
  onEvent: (event: RealtimeEvent) => void,
  setConnected: (v: boolean) => void
) {
  const onEventRef = React.useRef(onEvent);
  onEventRef.current = onEvent;
  const channelsKey = channels
    .map((c) => (c.scope === "restaurant" || c.scope === "user" ? `${c.scope}:${c.id}` : c.scope === "table" ? `table:${c.code}` : "owner"))
    .join("|");

  React.useEffect(() => {
    if (channels.length === 0) return;

    const sseParams = buildParams(channels);
    sseParams.set("sse", "1");
    const pollParams = buildParams(channels);

    let eventSource: EventSource | null = null;
    let reconnectDelay = SSE_RECONNECT_DELAY;
    let cancelled = false;
    let lastSeen = Date.now() - 1000;
    const seen = new Set<string>();

    function backfill() {
      if (cancelled || channels.length === 0) return;
      pollParams.set("since", new Date(lastSeen).toISOString());
      fetch(`/api/events?${pollParams.toString()}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!data || cancelled) return;
          const events = (data.events ?? []) as PollEvent[];
          for (const raw of events) {
            if (cancelled || seen.has(raw.id)) continue;
            seen.add(raw.id);
            const created = Date.parse(raw.createdAt);
            if (created > lastSeen) lastSeen = created;
            const evt: RealtimeEvent = {
              id: raw.id,
              channel: toChannel(raw),
              type: raw.type,
              payload: raw.payload,
              createdAt: created,
            };
            onEventRef.current(evt);
          }
        })
        .catch(() => {});
    }

    function handleMessage(raw: PollEvent & { type?: string }) {
      if (raw.type === "connected" || raw.type === "keepalive") return;
      if (seen.has(raw.id)) return;
      seen.add(raw.id);
      const created = Date.parse(raw.createdAt);
      if (created > lastSeen) lastSeen = created;
      const evt: RealtimeEvent = {
        id: raw.id,
        channel: toChannel(raw),
        type: raw.type,
        payload: raw.payload,
        createdAt: created,
      };
      onEventRef.current(evt);
    }

    function connect() {
      if (cancelled) return;
      eventSource = new EventSource(`/api/events?${sseParams.toString()}`);

      eventSource.onopen = () => {
        setConnected(true);
        reconnectDelay = SSE_RECONNECT_DELAY;
        backfill();
      };

      eventSource.onmessage = (e) => {
        try {
          handleMessage(JSON.parse(e.data) as PollEvent & { type?: string });
        } catch {}
      };

      eventSource.onerror = () => {
        setConnected(false);
        eventSource?.close();
        eventSource = null;
        if (!cancelled) {
          setTimeout(() => {
            reconnectDelay = Math.min(reconnectDelay * 1.5, SSE_RECONNECT_MAX);
            connect();
          }, reconnectDelay);
        }
      };
    }

    connect();

    function onVisibility() {
      if (document.hidden) {
        eventSource?.close();
        eventSource = null;
      } else {
        if (!eventSource) connect();
      }
    }

    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      eventSource?.close();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [channelsKey, setConnected]);
}

function useFallbackPolling(
  channels: RealtimeChannel[],
  onEvent: (event: RealtimeEvent) => void,
  setConnected: (v: boolean) => void
) {
  const onEventRef = React.useRef(onEvent);
  onEventRef.current = onEvent;
  const channelsKey = channels
    .map((c) => (c.scope === "restaurant" || c.scope === "user" ? `${c.scope}:${c.id}` : c.scope === "table" ? `table:${c.code}` : "owner"))
    .join("|");

  React.useEffect(() => {
    if (channels.length === 0) return;

    const params = buildParams(channels);

    let cancelled = false;
    let since = new Date(Date.now() - 1000).toISOString();
    const seen = new Set<string>();
    let interval: ReturnType<typeof setInterval> | undefined;
    let pollCount = 0;

    async function poll() {
      try {
        params.set("since", since);
        const res = await fetch(`/api/events?${params.toString()}`);
        if (!res.ok) {
          setConnected(false);
          return;
        }
        const data = (await res.json()) as { now: string; events: PollEvent[] };
        setConnected(true);
        since = data.now;
        pollCount++;

        const intervalMs = data.events.length > 0
          ? POLL_INTERVAL_BASE
          : Math.min(POLL_INTERVAL_BASE * Math.pow(1.5, Math.min(pollCount, 5)), POLL_INTERVAL_MAX);
        if (interval) clearInterval(interval);
        interval = setInterval(poll, intervalMs);

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
          onEventRef.current(evt);
        }
      } catch {
        setConnected(false);
      }
    }

    function start() {
      if (interval) return;
      poll();
      interval = setInterval(poll, POLL_INTERVAL_BASE);
    }

    function stop() {
      if (interval) {
        clearInterval(interval);
        interval = undefined;
      }
    }

    function onVisibility() {
      if (document.hidden) stop();
      else start();
    }

    document.addEventListener("visibilitychange", onVisibility);
    if (!document.hidden) start();

    return () => {
      cancelled = true;
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [channelsKey, setConnected]);
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

  const wrappedHandler = React.useCallback((evt: RealtimeEvent) => {
    setLastEvent(evt);
    handlerRef.current?.(evt);
  }, []);

  const hasSSESupport = typeof EventSource !== "undefined";

  if (hasSSESupport) {
    useSSE(channels, wrappedHandler, setConnected);
  } else {
    useFallbackPolling(channels, wrappedHandler, setConnected);
  }

  return { connected, lastEvent };
}
