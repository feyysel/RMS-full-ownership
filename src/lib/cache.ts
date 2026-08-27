import { subscribeLocal, publishEvent } from "@/lib/realtime-bus";

type CacheEntry<T> = { value: T; expires: number };

const store = new Map<string, CacheEntry<unknown>>();

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function getCached<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    store.delete(key);
    return null;
  }
  return entry.value as T;
}

export function setCached<T>(key: string, value: T, ttlMs: number): void {
  store.set(key, { value, expires: Date.now() + ttlMs });
}

export function invalidateCache(pattern: string): void {
  const regex = new RegExp(pattern);
  for (const key of store.keys()) {
    if (regex.test(key)) store.delete(key);
  }
}

export function subscribeEvents(
  key: string,
  listener: (event: unknown) => void
): () => void {
  return subscribeLocal(key, listener);
}

export function broadcastEvent(key: string, event: unknown): void {
  void publishEvent(key, event);
}

export function cleanupStaleEntries(maxAgeMs: number): void {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.expires + maxAgeMs) store.delete(key);
  }
}

if (typeof setInterval !== "undefined") {
  setInterval(() => cleanupStaleEntries(60_000), 120_000);
}
