import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "gold-gradient text-zinc-950 font-semibold shadow-[0_8px_30px_-8px_rgba(212,163,75,0.55)] hover:shadow-[0_8px_40px_-6px_rgba(212,163,75,0.7)] hover:brightness-105",
        outline:
          "border border-zinc-700/80 bg-transparent text-zinc-100 hover:border-gold/60 hover:text-gold-light hover:bg-gold/5",
        ghost: "text-zinc-300 hover:bg-white/5 hover:text-white",
        subtle:
          "bg-white/8 text-zinc-100 hover:bg-white/12 border border-white/10",
        danger:
          "bg-rose-500/15 text-rose-300 border border-rose-500/30 hover:bg-rose-500/25",
        success:
          "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25",
      },
      size: {
        default: "h-10 px-5",
        sm: "h-8 px-3.5 text-xs",
        lg: "h-12 px-7 text-base",
        icon: "h-10 w-10",
        iconSm: "h-8 w-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    />
  )
);
Button.displayName = "Button";

export { Button, buttonVariants };
