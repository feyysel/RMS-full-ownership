"use client";

import * as React from "react";

export function useFetch<T>(url: string | null, deps: unknown[] = []) {
  const [data, setData] = React.useState<T | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const refresh = React.useCallback(async () => {
    if (!url) return;
    try {
      const res = await fetch(url);
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        setError(d?.error ?? "Failed to load");
      } else {
        setData(await res.json());
        setError(null);
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, [url]);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error, refresh };
}
