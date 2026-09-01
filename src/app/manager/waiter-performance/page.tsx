"use client";

import * as React from "react";
import { UtensilsCrossed, Receipt, Banknote, TrendingUp, Wallet } from "lucide-react";
import { PageHeader, StatCard } from "@/components/ui/stat-card";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/input";
import { Skeleton, Avatar } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import { useRealtime } from "@/components/realtime/use-realtime";
import { useDebouncedCallback } from "@/lib/use-debounced";

type Totals = { orders: number; sales: number; collected: number; tips: number };

type WaiterRow = { id: string; name: string } & Totals;

type WaiterReport = {
  period: "day" | "week" | "month";
  since: string;
  summary: Totals;
  waiters: WaiterRow[];
};

const PERIOD_LABEL: Record<string, string> = {
  day: "Today",
  week: "This week",
  month: "This month",
};

const dash = (n: number) => (n === 0 ? "—" : formatCurrency(n));

export default function ManagerWaiterPerformance() {
  const [data, setData] = React.useState<WaiterReport | null>(null);
  const [period, setPeriod] = React.useState("day");
  const [restaurantId, setRestaurantId] = React.useState<string | null>(null);

  const fetchFor = React.useCallback(async (p: string) => {
    const res = await fetch(`/api/manager/waiter-performance?period=${p}`);
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
      const res = await fetch(`/api/manager/waiter-performance?period=${period}`);
      if (!res.ok) return;
      const json: WaiterReport = await res.json();
      if (!cancelled) setData(json);
    })();
    return () => {
      cancelled = true;
    };
  }, [period]);

  return (
    <div>
      <PageHeader
        title="Waiter performance"
        description="See every waiter's total orders, sales and cash collected — daily, weekly or monthly."
      />

      <div className="mb-5 flex items-center gap-3">
        <UtensilsCrossed className="h-4 w-4 text-gold-dark dark:text-gold-light" />
        <Select value={period} onChange={(e) => setPeriod(e.target.value)} className="w-44">
          <option value="day">Daily</option>
          <option value="week">Weekly</option>
          <option value="month">Monthly</option>
        </Select>
        {data && <Badge tone="gold">{PERIOD_LABEL[data.period]}</Badge>}
      </div>

      {!data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Orders" value={data.summary.orders} icon={Receipt} tone="sky" delay={0} />
            <StatCard label="Sales" value={formatCurrency(data.summary.sales)} icon={TrendingUp} tone="emerald" delay={0.06} />
            <StatCard label="Cash collected" value={formatCurrency(data.summary.collected)} icon={Wallet} tone="rose" delay={0.12} />
            <StatCard label="Tips" value={formatCurrency(data.summary.tips)} icon={Banknote} tone="gold" delay={0.18} />
          </div>

          <Card className="mt-4 overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-white/[0.06] text-xs uppercase tracking-wider text-zinc-500">
                    <th className="px-4 py-3 font-medium">Waiter</th>
                    <th className="px-4 py-3 text-right font-medium">Orders</th>
                    <th className="px-4 py-3 text-right font-medium">Sales</th>
                    <th className="px-4 py-3 text-right font-medium">Cash collected</th>
                    <th className="px-4 py-3 text-right font-medium">Tips</th>
                  </tr>
                </thead>
                <tbody>
                  {data.waiters.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-sm text-zinc-500">
                        No waiters or no sales in this period yet.
                      </td>
                    </tr>
                  ) : (
                    data.waiters.map((w) => (
                      <tr
                        key={w.id}
                        className="border-b border-zinc-200 dark:border-white/[0.04] transition-colors hover:bg-gold/[0.04]"
                      >
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-3">
                            <Avatar name={w.name} className="h-9 w-9 text-xs" />
                            <span className="font-medium text-zinc-900 dark:text-zinc-100">{w.name}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-zinc-900 dark:text-zinc-100">
                          {w.orders}
                        </td>
                        <td className="px-4 py-3 text-right text-zinc-600 dark:text-zinc-300">
                          {formatCurrency(w.sales)}
                        </td>
                        <td className="px-4 py-3 text-right text-zinc-600 dark:text-zinc-300">
                          {dash(w.collected)}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-gold-dark dark:text-gold-light">
                          {formatCurrency(w.tips)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
