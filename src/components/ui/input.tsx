import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type, ...props }, ref) => (
  <input
    type={type}
    className={cn(
      "flex h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 transition-colors focus:border-gold/60 focus:outline-none focus:ring-2 focus:ring-gold/20 disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    ref={ref}
    {...props}
  />
));
Input.displayName = "Input";

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    className={cn(
      "flex min-h-[80px] w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 transition-colors focus:border-gold/60 focus:outline-none focus:ring-2 focus:ring-gold/20 disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    ref={ref}
    {...props}
  />
));
Textarea.displayName = "Textarea";

const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <select
    className={cn(
      "flex h-11 w-full appearance-none rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2 text-sm text-zinc-100 transition-colors focus:border-gold/60 focus:outline-none focus:ring-2 focus:ring-gold/20 [&>option]:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    ref={ref}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = "Select";

function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        "mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-400",
        className
      )}
      {...props}
    />
  );
}

export { Input, Textarea, Select, Label };
