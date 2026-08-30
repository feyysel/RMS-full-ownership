"use client";

import * as React from "react";
import { Soup, TrendingUp, CalendarDays, CalendarRange } from "lucide-react";
import { PageHeader } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useRealtime } from "@/components/realtime/use-realtime";
import { useDebouncedCallback } from "@/lib/use-debounced";

type IngredientUsage = {
  period: "day" | "week" | "month";
  since: string;
  servingCount: number;
  ingredients: { name: string; quantities: number; share: number }[];
};

const PERIOD_LABEL: Record<string, string> = {
  day: "Today",
  week: "This week",
  month: "This month",
};

export default function ManagerIngredients() {
  const [data, setData] = React.useState<IngredientUsage | null>(null);
  const [period, setPeriod] = React.useState("day");
  const [restaurantId, setRestaurantId] = React.useState<string | null>(null);

  async function refreshNow() {
    const res = await fetch(`/api/manager/ingredient-usage?period=${period}`);
    if (res.ok) setData(await res.json());
  }
  const refresh = useDebouncedCallback(refreshNow, 300);

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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshNow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  const maxQty = data?.ingredients.reduce((m, i) => Math.max(m, i.quantities), 0) ?? 0;

  return (
    <div>
      <PageHeader
        title="Ingredient Usage"
        description="Track how much of each ingredient is being used based on menu items sold."
      />

      <div className="mb-5 flex items-center gap-3">
        <Soup className="h-4 w-4 text-gold-dark dark:text-gold-light" />
        <Select value={period} onChange={(e) => setPeriod(e.target.value)} className="w-44">
          <option value="day">Daily</option>
          <option value="week">Weekly</option>
          <option value="month">Monthly</option>
        </Select>
        {data && (
          <Badge tone="teal">{PERIOD_LABEL[data.period]} · {data.servingCount} servings</Badge>
        )}
      </div>

      {!data ? (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      ) : data.ingredients.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-20 text-center">
          <Soup className="mb-4 h-12 w-12 text-zinc-700" />
          <p className="font-display text-xl font-semibold text-zinc-800 dark:text-zinc-200">
            No ingredient usage yet
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            Sold menu items in this period will show the ingredients they used.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-4 w-4 text-gold-dark dark:text-gold-light" />
                Ingredients used by quantity
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {data.ingredients.map((ing) => {
                const barWidth = maxQty > 0 ? (ing.quantities / maxQty) * 100 : 0;
                return (
                  <div
                    key={ing.name}
                    className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-zinc-100 dark:hover:bg-white/[0.03]"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {ing.name}
                      </p>
                      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-white/[0.06]">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-gold/70 to-gold"
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-display text-base font-semibold text-zinc-900 dark:text-zinc-100">
                        {ing.quantities}
                      </p>
                      <p className="text-xs text-zinc-500">{ing.share}% of servings</p>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                {period === "day" ? (
                  <CalendarDays className="h-4 w-4 text-gold-dark dark:text-gold-light" />
                ) : (
                  <CalendarRange className="h-4 w-4 text-gold-dark dark:text-gold-light" />
                )}
                Period summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-zinc-500">
                Usage is derived from menu items sold in this period. Each time a dish is sold, the
                ingredients listed on it are counted once per serving.
              </p>
              <dl className="mt-4 space-y-3">
                <div className="flex items-center justify-between rounded-xl bg-zinc-100 px-3 py-2.5 dark:bg-white/[0.03]">
                  <dt className="text-sm text-zinc-500">Serving count</dt>
                  <dd className="font-display text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                    {data.servingCount}
                  </dd>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-zinc-100 px-3 py-2.5 dark:bg-white/[0.03]">
                  <dt className="text-sm text-zinc-500">Unique ingredients</dt>
                  <dd className="font-display text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                    {data.ingredients.length}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
