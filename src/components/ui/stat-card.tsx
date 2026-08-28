import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function StatCard({
  label,
  value,
  sub,
  icon,
  tone = "gold",
  delay = 0,
  loading = false,
}: {
  label: string;
  value: string | number;
  sub?: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "gold" | "emerald" | "sky" | "violet" | "rose";
  delay?: number;
  loading?: boolean;
}) {
  const tones: Record<string, string> = {
    gold: "bg-gold/10 text-gold-dark ring-gold/25 dark:text-gold-light",
    emerald: "bg-emerald-500/10 text-emerald-700 ring-emerald-500/25 dark:text-emerald-300",
    sky: "bg-sky-500/10 text-sky-700 ring-sky-500/25 dark:text-sky-300",
    violet: "bg-violet-500/10 text-violet-700 ring-violet-500/25 dark:text-violet-300",
    rose: "bg-rose-500/10 text-rose-700 ring-rose-500/25 dark:text-rose-300",
  };
  const Icon = icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
    >
      <Card className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-500">
            {label}
          </p>
          {loading ? (
            <Skeleton className="mt-2.5 h-8 w-28" />
          ) : (
            <p className="mt-2 font-display text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
              {value}
            </p>
          )}
          {!loading && sub && <p className="mt-1 text-xs text-zinc-500">{sub}</p>}
        </div>
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ring-1",
            tones[tone]
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
      </Card>
    </motion.div>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl dark:text-zinc-50">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
