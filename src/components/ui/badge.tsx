import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium tracking-wide",
  {
    variants: {
      tone: {
        amber: "border-amber-400/30 bg-amber-400/10 text-amber-300",
        gold: "border-gold/40 bg-gold/10 text-gold-light",
        sky: "border-sky-400/30 bg-sky-400/10 text-sky-300",
        violet: "border-violet-400/30 bg-violet-400/10 text-violet-300",
        emerald: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
        teal: "border-teal-400/30 bg-teal-400/10 text-teal-300",
        rose: "border-rose-400/30 bg-rose-400/10 text-rose-300",
        zinc: "border-zinc-500/40 bg-zinc-500/10 text-zinc-400",
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
