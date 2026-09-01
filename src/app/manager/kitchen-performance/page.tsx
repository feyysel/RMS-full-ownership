"use client";

import * as React from "react";
import { ChefHat, CookingPot, ClipboardList } from "lucide-react";
import { PageHeader, StatCard } from "@/components/ui/stat-card";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/input";
import { Skeleton, Avatar } from "@/components/ui/skeleton";
import { useRealtime } from "@/components/realtime/use-realtime";
import { useDebouncedCallback } from "@/lib/use-debounced";
import { cn } from "@/lib/utils";

type Totals = { orders: number; dishes: number };

type Dish = { name: string; quantity: number };

type KitchenRow = { id: string; name: string; orders: number; dishes: number; items: Dish[] };

type KitchenReport = {
  period: "day" | "week" | "month";
  since: string;
  summary: Totals;
  kitchen: KitchenRow[];
};

const PERIOD_LABEL: Record<string, string> = {
  day: "Today",
  week: "This week",
  month: "This month",
};

export default function ManagerKitchenPerformance() {
  const [data, setData] = React.useState<KitchenReport | null>(null);
  const [period, setPeriod] = React.useState("day");
  const [restaurantId, setRestaurantId] = React.useState<string | null>(null);

  const fetchFor = React.useCallback(async (p: string) => {
    const res = await fetch(`/api/manager/kitchen-performance?period=${p}`);
    if (res.ok) setData(await res.json());
  }, []);

  const refresh = useDebouncedCallback(() => fetchFor(period), 300);

  useRealtime(
    restaurantId ? [{ scope: "restaurant", id: restaurantId }] : [],
    () => refresh()
  );

  React.useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => setRestaurantId(d.user?.restaurantId ?? null))
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setData(null);
    (async () => {
      const res = await fetch(`/api/manager/kitchen-performance?period=${period}`);
      if (!res.ok) return;
      const json: KitchenReport = await res.json();
      if (!cancelled) setData(json);
    })();
    return () => {
      cancelled = true;
    };
  }, [period]);

  const maxDishes = data?.kitchen.reduce((m, k) => Math.max(m, k.dishes), 0) ?? 0;

  return (
    <div>
      <PageHeader
        title="Kitchen performance"
        description="See what every kitchen staff member cooked — daily, weekly or monthly."
      />

      <div className="mb-5 flex items-center gap-3">
        <ChefHat className="h-4 w-4 text-gold-dark dark:text-gold-light" />
        <Select value={period} onChange={(e) => setPeriod(e.target.value)} className="w-44">
          <option value="day">Daily</option>
          <option value="week">Weekly</option>
          <option value="month">Monthly</option>
        </Select>
        {data && <Badge tone="violet">{PERIOD_LABEL[data.period]}</Badge>}
      </div>

      {!data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard label="Orders cooked" value={data.summary.orders} icon={ClipboardList} tone="sky" delay={0} />
            <StatCard label="Dishes cooked" value={data.summary.dishes} icon={CookingPot} tone="violet" delay={0.06} />
          </div>

          {data.kitchen.length === 0 ? (
            <Card className="mt-4 flex flex-col items-center justify-center py-16 text-center">
              <ChefHat className="mb-3 h-8 w-8 text-zinc-600 dark:text-zinc-400" />
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                No kitchen crew or no cooking activity in this period yet.
              </p>
            </Card>
          ) : (
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {data.kitchen.map((k) => {
                const barWidth = maxDishes > 0 ? (k.dishes / maxDishes) * 100 : 0;
                return (
                  <Card key={k.id}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-3 text-base">
                        <Avatar name={k.name} className="h-9 w-9 text-xs" />
                        {k.name}
                      </CardTitle>
                    </CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-white/[0.06]">
                        <div
                          className={cn("h-full rounded-full bg-gradient-to-r from-violet/70 to-violet")}
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                      <Badge tone="violet">{k.dishes} {k.dishes === 1 ? "dish" : "dishes"}</Badge>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                      <div className="rounded-xl bg-zinc-100 px-3 py-2 dark:bg-white/[0.03]">
                        <p className="text-xs uppercase tracking-wider text-zinc-500">Orders</p>
                        <p className="font-display text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                          {k.orders}
                        </p>
                      </div>
                    </div>
                    {k.items.length > 0 && (
                      <div className="mt-4">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                          What they cooked
                        </p>
                        <div className="space-y-1">
                          {k.items.map((item) => (
                            <div
                              key={item.name}
                              className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-zinc-100 dark:hover:bg-white/[0.03]"
                            >
                              <span className="truncate text-zinc-700 dark:text-zinc-200">{item.name}</span>
                              <span className="ml-2 shrink-0 font-semibold text-zinc-900 dark:text-zinc-100">
                                {item.quantity}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
