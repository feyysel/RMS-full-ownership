"use client";

import { motion } from "motion/react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function TrendChart({
  labels,
  values,
  title = "Revenue · last 7 days",
}: {
  labels: string[];
  values: number[];
  title?: string;
}) {
  const max = Math.max(...values, 1);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <div className="flex h-44 items-end gap-2 sm:gap-3">
        {values.map((v, i) => {
          const h = Math.max(4, (v / max) * 100);
          return (
            <div
              key={labels[i]}
              className="group flex flex-1 flex-col items-center gap-2"
            >
              <span className="text-[10px] text-zinc-500 opacity-0 transition-opacity group-hover:opacity-100">
                {v.toFixed(0)} ETB
              </span>
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${h}%` }}
                transition={{ duration: 0.7, delay: i * 0.05, ease: "easeOut" }}
                className={cn(
                  "w-full max-w-10 rounded-t-lg bg-gradient-to-t transition-all",
                  v === max
                    ? "from-gold-dark via-gold to-gold-light shadow-[0_0_20px_rgba(212,163,75,0.4)]"
                    : "from-gold/30 to-gold/15 group-hover:from-gold/50 group-hover:to-gold/25"
                )}
              />
              <span className="text-[10px] uppercase text-zinc-500">
                {labels[i]}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export function StatusBreakdown({
  data,
  title = "Order status",
}: {
  data: { status: string; count: number }[];
  title?: string;
}) {
  const total = data.reduce((s, d) => s + d.count, 0) || 1;
  const tones: Record<string, string> = {
    PENDING: "bg-amber-400",
    ACCEPTED: "bg-sky-400",
    COOKING: "bg-violet-400",
    READY: "bg-emerald-400",
    SERVED: "bg-teal-400",
    COMPLETED: "bg-zinc-500",
    CANCELLED: "bg-rose-400",
  };
  const labels: Record<string, string> = {
    PENDING: "Pending",
    ACCEPTED: "Accepted",
    COOKING: "Cooking",
    READY: "Ready",
    SERVED: "Served",
    COMPLETED: "Completed",
    CANCELLED: "Cancelled",
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <div className="space-y-3">
        {data.map((d) => (
          <div key={d.status} className="flex items-center gap-3">
            <span className="w-24 shrink-0 text-xs text-zinc-400">
              {labels[d.status] ?? d.status}
            </span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(d.count / total) * 100}%` }}
                transition={{ duration: 0.6 }}
                className={cn("h-full rounded-full", tones[d.status] ?? "bg-gold")}
              />
            </div>
            <span className="w-8 text-right text-xs font-medium text-zinc-300">
              {d.count}
            </span>
          </div>
        ))}
        {data.length === 0 && (
          <p className="py-6 text-center text-sm text-zinc-500">No orders yet</p>
        )}
      </div>
    </Card>
  );
}
