"use client";

import * as React from "react";
import {
  Banknote,
  ShoppingBag,
  Grid3X3,
  Users,
  ChefHat,
  UtensilsCrossed,
  ArrowUpRight,
} from "lucide-react";
import Link from "next/link";
import { StatCard, PageHeader } from "@/components/ui/stat-card";
import { TrendChart, StatusBreakdown } from "@/components/ui/chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, timeAgo } from "@/lib/utils";
import { useFetch } from "@/lib/use-fetch";
import { useRealtime } from "@/components/realtime/use-realtime";
import { useDebouncedCallback } from "@/lib/use-debounced";

type ManagerStats = {
  stats: {
    revenueToday: number;
    ordersToday: number;
    totalOrders: number;
    activeTables: number;
    employeeCount: number;
    menuCount: number;
    openOrders: number;
  };
  ordersByStatus: { status: string; _count: number }[];
  recentOrders: {
    id: string;
    orderNumber: number;
    status: string;
    total: number;
    createdAt: string;
    tableLabel: string;
    items: { name: string; quantity: number }[];
    table: { number: number } | null;
    waiter: { name: string } | null;
  }[];
  topItems: { name: string; qty: number }[];
  trend: { labels: string[]; revenue: number[] };
};

export default function ManagerOverview() {
  const { data, refresh } = useFetch<ManagerStats>("/api/stats");
  const [restaurantId, setRestaurantId] = React.useState<string | null>(null);
  const refreshDebounced = useDebouncedCallback(refresh, 500);

  useRealtime(
    restaurantId ? [{ scope: "restaurant", id: restaurantId }] : [],
    () => refreshDebounced()
  );

  React.useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => setRestaurantId(d.user?.restaurantId ?? null))
      .catch(() => {});
  }, []);

  const d = data;

  return (
    <div>
      <PageHeader
        title="Restaurant Overview"
        description="Today's performance at a glance — refreshed live."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Revenue today" value={formatCurrency(d?.stats.revenueToday ?? 0)} sub="excl. cancelled" icon={Banknote} tone="emerald" delay={0} loading={!d} />
        <StatCard label="Orders today" value={d?.stats.ordersToday ?? 0} sub={d ? `${d.stats.openOrders} active now` : undefined} icon={ShoppingBag} tone="gold" delay={0.06} loading={!d} />
        <StatCard label="Tables in use" value={d?.stats.activeTables ?? 0} sub="occupied right now" icon={Grid3X3} tone="sky" delay={0.12} loading={!d} />
        <StatCard label="Team & menu" value={d?.stats.employeeCount ?? 0} sub={d ? `${d.stats.menuCount} items live` : undefined} icon={Users} tone="violet" delay={0.18} loading={!d} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {d ? (
            <TrendChart labels={d.trend.labels} values={d.trend.revenue} />
          ) : (
            <ChartPlaceholder />
          )}
        </div>
        {d ? (
          <StatusBreakdown
            data={d.ordersByStatus.map((x) => ({ status: x.status, count: x._count }))}
            title="Today's order flow"
          />
        ) : (
          <ChartPlaceholder />
        )}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ChefHat className="h-4 w-4 text-gold-dark dark:text-gold-light" />
              Best sellers
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!d
              ? Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-8" />
                ))
              : d.topItems.map((item, i) => (
                  <div key={item.name} className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gold/10 text-xs font-bold text-gold-dark ring-1 ring-gold/20 dark:text-gold-light">
                      {i + 1}
                    </span>
                    <p className="flex-1 truncate text-sm text-zinc-800 dark:text-zinc-200">{item.name}</p>
                    <Badge tone="amber">{item.qty} sold</Badge>
                  </div>
                ))}
            {d && d.topItems.length === 0 && (
              <p className="py-6 text-center text-sm text-zinc-500">No sales yet</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <UtensilsCrossed className="h-4 w-4 text-gold-dark dark:text-gold-light" />
              Recent orders
            </CardTitle>
            <Link href="/manager/menu" className="flex items-center gap-1 text-xs text-gold-dark hover:underline dark:text-gold-light">
              Manage menu <ArrowUpRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="space-y-1">
            {!d
              ? Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12" />
                ))
              : d.recentOrders.map((o) => (
                  <div key={o.id} className="flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-zinc-100 dark:hover:bg-white/[0.03]">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gold/10 font-display text-xs font-semibold text-gold-dark ring-1 ring-gold/20 dark:text-gold-light">
                      #{o.orderNumber}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{o.tableLabel}</p>
                      <p className="truncate text-xs text-zinc-500">
                        {o.waiter?.name ?? "Customer"} · {timeAgo(o.createdAt)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{formatCurrency(o.total)}</p>
                      <Badge tone={toneFor(o.status)}>{o.status}</Badge>
                    </div>
                  </div>
                ))}
            {d && d.recentOrders.length === 0 && (
              <p className="py-6 text-center text-sm text-zinc-500">No orders yet</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ChartPlaceholder() {
  return (
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
  );
}

function toneFor(status: string): "amber" | "sky" | "violet" | "emerald" | "teal" | "zinc" | "rose" {
  const map: Record<string, "amber" | "sky" | "violet" | "emerald" | "teal" | "zinc" | "rose"> = {
    PENDING: "amber",
    ACCEPTED: "sky",
    COOKING: "violet",
    READY: "emerald",
    SERVED: "teal",
    COMPLETED: "zinc",
    CANCELLED: "rose",
  };
  return map[status] ?? "zinc";
}
