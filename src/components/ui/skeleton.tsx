import { cn } from "@/lib/utils";

export function Skeleton({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-xl bg-white/[0.06]",
        className
      )}
      style={style}
    />
  );
}

export function Avatar({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-gold to-gold-dark text-sm font-bold text-zinc-950",
        className
      )}
    >
      {initials}
    </div>
  );
}
