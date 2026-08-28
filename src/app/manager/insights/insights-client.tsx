"use client";

import * as React from "react";
import {
  Store,
  Users,
  Banknote,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { StatCard, PageHeader } from "@/components/ui/stat-card";
import { TrendChart } from "@/components/ui/chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import { useRealtime } from "@/components/realtime/use-realtime";
import { useDebouncedCallback } from "@/lib/use-debounced";

type OwnerStats = {
  stats: {
    restaurantCount: number;
    userCount: number;
    revenue: number;
  };
  restaurants: {
    id: string;
    name: string;
    parentName: string | null;
    users: number;
    tables: number;
    menuItems: number;
    revenue: number;
    createdAt: string;
  }[];
  trend: { labels: string[]; revenue: number[] };
};

export default function InsightsClient() {
  const [data, setData] = React.useState<OwnerStats | null>(null);

  async function refreshNow() {
    const res = await fetch("/api/owner/stats");
    if (res.ok) setData(await res.json());
  }
  const refresh = useDebouncedCallback(refreshNow, 250);

  useRealtime([{ scope: "owner" }], () => {
    refresh();
  });

  React.useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const d = data;

  const todayRevenue = d?.trend.revenue[d.trend.revenue.length - 1] ?? 0;
  const yesterdayRevenue = d?.trend.revenue[d.trend.revenue.length - 2] ?? 0;
  const delta =
    yesterdayRevenue > 0
      ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100
      : 0;

  return (
    <div>
      <PageHeader
        title="Owner Insights"
        description="A live pulse across your restaurant and all of its branches."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Restaurants"
          value={d?.stats.restaurantCount ?? 0}
          sub="main + branches"
          icon={Store}
          tone="gold"
          delay={0}
          loading={!d}
        />
        <StatCard
          label="Users"
          value={d?.stats.userCount ?? 0}
          sub="across all roles"
          icon={Users}
          tone="sky"
          delay={0.06}
          loading={!d}
        />
        <StatCard
          label="Revenue"
          value={formatCurrency(d?.stats.revenue ?? 0)}
          sub={
            <span className="inline-flex items-center gap-1">
              {delta >= 0 ? (
                <ArrowUpRight className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" />
              ) : (
                <ArrowDownRight className="h-3.5 w-3.5 text-rose-700 dark:text-rose-400" />
              )}
              {Math.abs(delta).toFixed(1)}% vs yesterday
            </span>
          }
          icon={Banknote}
          tone="emerald"
          delay={0.18}
          loading={!d}
        />
      </div>

      <div className="mt-4">
        {d ? (
          <TrendChart labels={d.trend.labels} values={d.trend.revenue} />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Loading…</CardTitle>
            </CardHeader>
            <div className="flex h-44 items-end gap-2 sm:gap-3">
              {Array.from({ length: 7 }).map((_, i) => (
                <Skeleton key={i} className="flex-1 rounded-t-lg" style={{ height: `${40 + (i % 3) * 25}%` }} />
              ))}
            </div>
          </Card>
        )}
      </div>

      <div className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-gold-dark dark:text-gold-light" />
              Revenue by location
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {!d
              ? Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12" />
                ))
              : d.restaurants.map((r, i) => (
                  <div
                    key={r.id}
                    className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-zinc-100 dark:hover:bg-white/[0.03]"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-xs font-bold text-gold-dark dark:bg-white/5 dark:text-gold-light">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{r.name}</p>
                      <p className="text-xs text-zinc-500">
                        {r.tables} tables · {r.menuItems} items · {r.users} staff
                        {r.parentName ? ` · branch of ${r.parentName}` : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        {formatCurrency(r.revenue)}
                      </p>
                    </div>
                  </div>
                ))}
            {d && d.restaurants.length === 0 && (
              <p className="py-6 text-center text-sm text-zinc-500">
                No restaurants yet
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
