"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme/theme-provider";
import { cn } from "@/lib/utils";

export function ThemeToggle({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md";
}) {
  const { resolved, toggle } = useTheme();
  const pad = size === "sm" ? "p-2" : "p-2.5";
  return (
    <button
      type="button"
      onClick={toggle}
      title={`Switch to ${resolved === "dark" ? "light" : "dark"} mode`}
      className={cn(
        "relative flex items-center justify-center rounded-xl text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-100 dark:text-zinc-400 dark:hover:text-white",
        pad,
        className
      )}
    >
      <Sun className="h-5 w-5 scale-100 rotate-0 transition-all duration-300 dark:scale-0 dark:-rotate-90" />
      <Moon className="absolute h-5 w-5 scale-0 rotate-90 transition-all duration-300 dark:scale-100 dark:rotate-0" />
    </button>
  );
}
