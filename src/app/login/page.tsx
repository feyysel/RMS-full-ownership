"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Loader2, Lock, Phone, UtensilsCrossed, Eye, EyeOff } from "lucide-react";
import { ROLE_HOME } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [showRegister, setShowRegister] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Login failed");
        return;
      }
      router.push(ROLE_HOME[data.user.role] ?? "/");
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0a0a0b] px-4 py-10">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-[480px] w-[720px] -translate-x-1/2 rounded-full bg-gold/[0.12] blur-[130px]" />
        <div className="absolute bottom-0 right-0 h-[360px] w-[420px] rounded-full bg-amber-700/10 blur-[110px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-3xl bg-gradient-to-br from-gold to-gold-dark shadow-[0_10px_40px_-10px_rgba(212,163,75,0.8)]">
            <UtensilsCrossed className="h-7 w-7 text-zinc-950" />
          </div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-zinc-50">
            Welcome back
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            Sign in to your workspace — <span className="gold-gradient-text font-medium">Platform</span>
          </p>
        </div>

        <div className="glass rounded-3xl p-8 shadow-soft">
          <form onSubmit={onSubmit} className="space-y-5">
            <div>
              <Label htmlFor="phone">Phone number</Label>
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <Input
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="pl-10"
                  placeholder="0982101908"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 transition-colors hover:text-zinc-300"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <motion.p
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-sm text-rose-300"
              >
                {error}
              </motion.p>
            )}

            <Button type="submit" disabled={loading} className="w-full" size="lg">
              {loading && <Loader2 className="h-5 w-5 animate-spin" />}
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <div className="mt-6 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
            <p className="mb-2 text-center text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
              Demo accounts
            </p>
            <div className="grid grid-cols-1 gap-1.5 text-xs text-zinc-400">
              <button
                type="button"
                onClick={() => {
                  setPhone("0982101908");
                  setPassword("owner123");
                }}
                className="flex items-center justify-between rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-white/5 hover:text-gold-light"
              >
                <span>Owner</span> <span className="text-zinc-500">0982101908</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setPhone("09171234568");
                  setPassword("manager123");
                }}
                className="flex items-center justify-between rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-white/5 hover:text-gold-light"
              >
                <span>Manager</span> <span className="text-zinc-500">09171234568</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setPhone("09171234569");
                  setPassword("waiter123");
                }}
                className="flex items-center justify-between rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-white/5 hover:text-gold-light"
              >
                <span>Waiter</span> <span className="text-zinc-500">09171234569</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setPhone("09171234571");
                  setPassword("kitchen123");
                }}
                className="flex items-center justify-between rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-white/5 hover:text-gold-light"
              >
                <span>Kitchen</span> <span className="text-zinc-500">09171234571</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setPhone("09171234573");
                  setPassword("cashier123");
                }}
                className="flex items-center justify-between rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-white/5 hover:text-gold-light"
              >
                <span>Cashier</span> <span className="text-zinc-500">09171234573</span>
              </button>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
            <p className="text-center text-sm text-zinc-400">
              Don&apos;t have an account?
            </p>
            <Button
              type="button"
              variant="ghost"
              className="mt-2 w-full"
              onClick={() => setShowRegister((s) => !s)}
            >
              {showRegister ? "Close" : "Register"}
            </Button>
            {showRegister && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-3 space-y-1.5 border-t border-white/[0.07] pt-3"
              >
                <p className="text-xs text-zinc-500">
                  Staff accounts are created by the restaurant owner. Contact them to register:
                </p>
                <a
                  href="tel:+251982101908"
                  className="flex items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs transition-colors hover:bg-white/5 hover:text-gold-light"
                >
                  <span>Owner</span> <span className="text-zinc-500">+251 98 210 1908</span>
                </a>
                <a
                  href="tel:+251717136667"
                  className="flex items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs transition-colors hover:bg-white/5 hover:text-gold-light"
                >
                  <span>Optional contact</span> <span className="text-zinc-500">+251 71 713 6667</span>
                </a>
              </motion.div>
            )}
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-zinc-500">
          <Link href="/" className="transition-colors hover:text-gold-light">
            ← Back to home
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
