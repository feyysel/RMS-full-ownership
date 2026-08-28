import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium tracking-wide",
  {
    variants: {
      tone: {
        amber: "border-amber-500/40 bg-amber-400/15 text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300",
        gold: "border-gold/50 bg-gold/15 text-gold-dark dark:border-gold/40 dark:bg-gold/10 dark:text-gold-light",
        sky: "border-sky-500/40 bg-sky-400/15 text-sky-700 dark:border-sky-400/30 dark:bg-sky-400/10 dark:text-sky-300",
        violet: "border-violet-500/40 bg-violet-400/15 text-violet-700 dark:border-violet-400/30 dark:bg-violet-400/10 dark:text-violet-300",
        emerald: "border-emerald-500/40 bg-emerald-400/15 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-300",
        teal: "border-teal-500/40 bg-teal-400/15 text-teal-700 dark:border-teal-400/30 dark:bg-teal-400/10 dark:text-teal-300",
        rose: "border-rose-500/40 bg-rose-400/15 text-rose-700 dark:border-rose-400/30 dark:bg-rose-400/10 dark:text-rose-300",
        zinc: "border-zinc-400/50 bg-zinc-400/15 text-zinc-600 dark:border-zinc-500/40 dark:bg-zinc-500/10 dark:text-zinc-400",
      },
    },
    defaultVariants: {
      tone: "zinc",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return (
    <span
      className={cn(badgeVariants({ tone }), "inline-flex", className)}
      {...props}
    />
  );
}

export function StatusDot({ className }: { className?: string }) {
  return (
    <span className={cn("relative flex h-2 w-2", className)}>
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-current" />
    </span>
  );
}
