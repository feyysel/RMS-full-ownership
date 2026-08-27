import { Pool, type PoolClient } from "pg";

const NOTIFY_CHANNEL = "rms_events";

type Listener = (event: unknown) => void;

const LOCAL_SUBSCRIBERS = new Map<string, Set<Listener>>();

let pool: Pool | null = null;
let gatewayClient: PoolClient | null = null;
let gatewayReady: Promise<void> | null = null;
let keepAliveTimer: ReturnType<typeof setInterval> | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL ?? "",
      max: 1,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
  }
  return pool;
}

function dispatchLocal(channelKey: string, event: unknown) {
  const set = LOCAL_SUBSCRIBERS.get(channelKey);
  if (!set) return;
  for (const listener of set) {
    try {
      listener(event);
    } catch {
      /* ignore listener errors */
    }
  }
}

async function connectGateway(client: PoolClient) {
  await client.query(`LISTEN ${NOTIFY_CHANNEL}`);
  client.on("notification", (msg) => {
    if (msg.channel !== NOTIFY_CHANNEL) return;
    let payload: unknown;
    try {
      payload = JSON.parse(msg.payload ?? "{}");
    } catch {
      return;
    }
    const p = payload as { channelKey?: string; event?: unknown };
    if (typeof p.channelKey !== "string" || p.event == null) return;
    dispatchLocal(p.channelKey, p.event);
  });
  client.on("error", () => {
    gatewayClient = null;
    gatewayReady = null;
    startGatewayKeepAlive();
  });
  client.on("end", () => {
    gatewayClient = null;
    gatewayReady = null;
    startGatewayKeepAlive();
  });
}

function clearGateway() {
  if (gatewayClient) {
    try {
      gatewayClient.removeAllListeners();
    } catch {}
    try {
      gatewayClient.release(true);
    } catch {}
  }
  gatewayClient = null;
  gatewayReady = null;
}

function startGatewayKeepAlive() {
  if (keepAliveTimer) return;
  keepAliveTimer = setInterval(async () => {
    const client = gatewayClient;
    if (!client) {
      if (LOCAL_SUBSCRIBERS.size > 0) void ensureGateway();
      return;
    }
    try {
      await client.query("SELECT 1");
    } catch {
      clearGateway();
      if (LOCAL_SUBSCRIBERS.size > 0) void ensureGateway();
    }
  }, 25_000);
}

function stopGatewayKeepAlive() {
  if (keepAliveTimer) {
    clearInterval(keepAliveTimer);
    keepAliveTimer = null;
  }
}

async function ensureGateway(): Promise<void> {
  if (gatewayClient) return;
  if (gatewayReady) return gatewayReady;
  gatewayReady = (async () => {
    try {
      const client = await getPool().connect();
      gatewayClient = client;
      await connectGateway(client);
      startGatewayKeepAlive();
    } catch (err) {
      gatewayClient = null;
      console.error("listener gateway connect failed", err);
      stopGatewayKeepAlive();
    } finally {
      gatewayReady = null;
    }
  })();
  return gatewayReady;
}

export function subscribeLocal(channelKey: string, listener: Listener): () => void {
  let set = LOCAL_SUBSCRIBERS.get(channelKey);
  if (!set) {
    set = new Set();
    LOCAL_SUBSCRIBERS.set(channelKey, set);
  }
  set.add(listener);
  void ensureGateway();
  return () => {
    set!.delete(listener);
    if (set!.size === 0) LOCAL_SUBSCRIBERS.delete(channelKey);
  };
}

export async function publishEvent(channelKey: string, event: unknown): Promise<void> {
  dispatchLocal(channelKey, event);

  await ensureGateway();
  if (!gatewayClient) return;

  try {
    await gatewayClient.query("SELECT pg_notify($1, $2)", [
      NOTIFY_CHANNEL,
      JSON.stringify({ channelKey, event }),
    ]);
  } catch (err) {
    console.error("publishEvent pg_notify failed", err);
  }
}
