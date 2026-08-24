"use client";

import * as React from "react";
import { motion } from "motion/react";
import {
  Banknote,
  CalendarDays,
  CircleDollarSign,
  Coins,
  Loader2,
  Receipt,
  RefreshCw,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/stat-card";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatCurrency } from "@/lib/utils";
import { useRealtime } from "@/components/realtime/use-realtime";
import { useDebouncedCallback } from "@/lib/use-debounced";

type Totals = { served: number; sales: number; collected: number; tips: number };

type DayRow = Totals & { date: string; isToday: boolean };

type EarningOrder = {
  id: string;
  orderNumber: number;
  tableLabel: string | null;
  status: string;
  total: number;
  payable: number;
  collectedAmount: number | null;
  tip: number;
  createdAt: string;
};

type Earnings = {
  today: { date: string } & Totals;
  week: { from: string; to: string } & Totals;
  days: DayRow[];
  orders: EarningOrder[];
};

const DAY_FMT = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
});

const dash = (n: number | null | undefined) =>
  n == null ? "—" : formatCurrency(n);

export default function WaiterEarnings() {
  const [restaurantId, setRestaurantId] = React.useState<string | null>(null);
  const [data, setData] = React.useState<Earnings | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);

  async function load(spinner = true) {
    if (spinner) setRefreshing(true);
    try {
      const res = await fetch("/api/waiter/earnings");
      if (!res.ok) throw new Error("Failed");
      const d = await res.json();
      setData(d);
    } catch {
      toast.error("Could not load your earnings");
    } finally {
      setRefreshing(false);
    }
  }

  const loadDebounced = useDebouncedCallback(() => load(false), 400);

  useRealtime(
    restaurantId ? [{ scope: "restaurant", id: restaurantId }] : [],
    (evt) => {
      if (evt.type !== "heartbeat" && evt.type !== "hello") loadDebounced();
    }
  );

  React.useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => setRestaurantId(d.user?.restaurantId ?? null))
      .catch(() => {});
    loadDebounced();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const t = data?.today;
  const w = data?.week;

  return (
    <div>
      <PageHeader
        title="My earnings"
        description="Everything you served today and this week — sales, cash collected and tips."
        action={
          <Button variant="subtle" onClick={() => load()} disabled={refreshing}>
            {refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Refresh
          </Button>
        }
      />

      <div className="space-y-6">
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gold-light">
            <CircleDollarSign className="h-4 w-4" /> Today
          </h2>
          {t ? (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat
                label="Orders served"
                value={String(t.served)}
                sub={t.served === 1 ? "order" : "orders"}
                icon={Receipt}
                tone="text-sky-300 bg-sky-500/10"
              />
              <Stat
                label="Sales"
                value={formatCurrency(t.sales)}
                sub="actual bill amount"
                icon={TrendingUp}
                tone="text-emerald-300 bg-emerald-500/10"
              />
              <Stat
                label="Cash collected"
                value={formatCurrency(t.collected)}
                sub="from customers"
                icon={Wallet}
                tone="text-amber-300 bg-amber-500/10"
              />
              <Stat
                label="Tips today"
                value={formatCurrency(t.tips)}
                sub="yours to keep"
                icon={Coins}
                tone="text-gold-light bg-gold/10"
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-28" />
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-zinc-400">
            <CalendarDays className="h-4 w-4 text-gold-light" /> This week
          </h2>
          <Card className="p-4">
            {w ? (
              <>
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-xs text-zinc-500">
                    {`${DAY_FMT.format(new Date(w.from))} — ${DAY_FMT.format(new Date(w.to))}`}
                  </p>
                  <Badge tone="emerald">Resets every Monday</Badge>
                </div>

                <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <MiniStat label="Served" value={String(w.served)} />
                  <MiniStat label="Sales" value={formatCurrency(w.sales)} />
                  <MiniStat label="Collected" value={formatCurrency(w.collected)} />
                  <MiniStat label="Tips" value={formatCurrency(w.tips)} />
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-white/[0.06] text-xs uppercase tracking-wider text-zinc-500">
                        <th className="pb-2 pr-3 font-medium">Day</th>
                        <th className="pb-2 pr-3 font-medium">Served</th>
                        <th className="pb-2 pr-3 font-medium">Sales</th>
                        <th className="pb-2 pr-3 font-medium">Collected</th>
                        <th className="pb-2 font-medium">Tips</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data!.days.map((d) => (
                        <tr
                          key={d.date}
                          className={cn(
                            "border-b border-white/[0.04]",
                            d.isToday && "bg-gold/[0.05]"
                          )}
                        >
                          <td className="py-2.5 pr-3">
                            <span className="flex items-center gap-2">
                              {DAY_FMT.format(new Date(d.date))}
                              {d.isToday && <Badge tone="gold">Today</Badge>}
                            </span>
                          </td>
                          <td className="py-2.5 pr-3 text-zinc-300">{d.served}</td>
                          <td className="py-2.5 pr-3 text-zinc-300">{formatCurrency(d.sales)}</td>
                          <td className="py-2.5 pr-3 text-zinc-300">{formatCurrency(d.collected)}</td>
                          <td className="py-2.5 font-semibold text-gold-light">
                            {formatCurrency(d.tips)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <>
                <Skeleton className="mb-5 h-4 w-52" />
                <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-20" />
                  ))}
                </div>
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-9" />
                  ))}
                </div>
              </>
            )}
          </Card>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-zinc-400">
              <Banknote className="h-4 w-4 text-gold-light" /> This week&apos;s orders
            </h2>
            <span className="text-xs text-zinc-500">
              {data ? `${data.orders.length} shown` : "…"}
            </span>
          </div>

          {!data ? (
            <div className="space-y-2.5">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          ) : data.orders.length === 0 ? (
            <Card className="flex flex-col items-center justify-center py-14 text-center">
              <Coins className="mb-3 h-8 w-8 text-zinc-600" />
              <p className="text-sm text-zinc-400">No completed orders this week yet.</p>
              <p className="mt-1 text-xs text-zinc-600">
                When you complete an order and enter the cash you collected, the tip shows up here.
              </p>
            </Card>
          ) : (
            <div className="space-y-2.5">
              {data.orders.map((o) => (
                <motion.div
                  key={o.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3"
                >
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gold/10 font-display text-sm font-bold text-gold-light ring-1 ring-gold/25">
                        #{o.orderNumber}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-zinc-100">
                          {o.tableLabel ?? "Takeaway"}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {new Date(o.createdAt).toLocaleString(undefined, {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <div className="text-right">
                        <p className="text-xs text-zinc-500">Bill</p>
                        <p className="text-zinc-300">{formatCurrency(o.payable)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-zinc-500">Collected</p>
                        <p className="text-zinc-300">{dash(o.collectedAmount)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-zinc-500">Tip</p>
                        <p className="font-semibold text-gold-light">{formatCurrency(o.tip)}</p>
                      </div>
                      <Badge tone={o.status === "COMPLETED" ? "zinc" : "teal"}>
                        {o.status}
                      </Badge>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
}) {
  return (
    <Card className="flex items-center justify-between p-4">
      <div>
        <p className="text-xs uppercase tracking-wider text-zinc-500">{label}</p>
        <p className="mt-1 font-display text-2xl font-semibold text-zinc-50">{value}</p>
        <p className="mt-0.5 text-[11px] text-zinc-500">{sub}</p>
      </div>
      <div className={cn("flex h-10 w-10 items-center justify-center rounded-2xl", tone)}>
        <Icon className="h-5 w-5" />
      </div>
    </Card>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/[0.03] px-4 py-3 ring-1 ring-white/[0.06]">
      <p className="text-xs uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="mt-1 font-display text-xl font-semibold text-zinc-100">{value}</p>
    </div>
  );
}
