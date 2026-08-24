"use client";

import * as React from "react";

export function useDebouncedCallback<A extends unknown[]>(
  fn: (...args: A) => unknown,
  wait = 250
) {
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const fnRef = React.useRef(fn);

  React.useEffect(() => {
    fnRef.current = fn;
  });

  React.useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  return React.useCallback(
    (...args: A) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        timer.current = null;
        void fnRef.current(...args);
      }, wait);
    },
    [wait]
  );
}
