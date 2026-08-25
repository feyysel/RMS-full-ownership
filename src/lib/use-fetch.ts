"use client";

import * as React from "react";

const inflight = new Map<string, Promise<unknown>>();

export function useFetch<T>(url: string | null, deps: unknown[] = []) {
  const [data, setData] = React.useState<T | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    if (!url) return;
    try {
      let p = inflight.get(url);
      if (!p) {
        p = fetch(url).then((res) => {
          if (!res.ok) return res.json().then((d) => { throw new Error(d?.error ?? "Failed"); });
          return res.json();
        });
        inflight.set(url, p);
      }
      const result = await p;
      setData(result as T);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
      if (url) inflight.delete(url);
    }
  }, [url]);

  React.useEffect(() => {
    setLoading(true);
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error, refresh };
}
