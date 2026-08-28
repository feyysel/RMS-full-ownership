"use client";

import Link from "next/link";
import { motion } from "motion/react";
import {
  ArrowRight,
  ChefHat,
  LayoutDashboard,
  BellRing,
  ShoppingBag,
  Users,
  UtensilsCrossed,
  Sparkles,
} from "lucide-react";

const ROLES = [
  {
    icon: LayoutDashboard,
    title: "System Admin",
    desc: "Oversee every restaurant, user and system-wide insight from one premium command center.",
  },
  {
    icon: Users,
    title: "Restaurant Manager",
    desc: "Hire waiters and chefs, craft a stunning menu, and control pricing & ingredients live.",
  },
  {
    icon: ChefHat,
    title: "Kitchen",
    desc: "Accept orders first-come-first-served, cook, and send detailed receipts to waiters.",
  },
  {
    icon: BellRing,
    title: "Waiter",
    desc: "Own your tables, take orders, get pinged the instant a customer rings the bell.",
  },
  {
    icon: ShoppingBag,
    title: "Customer",
    desc: "Scan the table QR, browse ingredients & prices, order, and call service with a bell.",
  },
];

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-gold/[0.12] blur-[140px]" />
        <div className="absolute bottom-0 left-0 h-[400px] w-[500px] rounded-full bg-amber-600/10 blur-[120px]" />
        <div className="absolute right-0 top-1/3 h-[400px] w-[400px] rounded-full bg-violet-600/10 blur-[120px]" />
      </div>

      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-gold to-gold-dark shadow-[0_8px_30px_-8px_rgba(212,163,75,0.6)]">
            <UtensilsCrossed className="h-5 w-5 text-zinc-950" />
          </div>
          <span className="font-display text-xl font-semibold tracking-tight">
            <span className="gold-gradient-text">Plateform</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="rounded-full border border-zinc-200 dark:border-white/10 px-5 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-300 transition-colors hover:border-gold/50 hover:text-gold-dark dark:hover:text-gold-light"
          >
            Sign in
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-7xl px-6">
        <section className="flex flex-col items-center pb-20 pt-16 text-center sm:pt-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-gold/25 bg-gold/[0.07] px-4 py-1.5 text-xs font-medium uppercase tracking-widest text-gold-dark dark:text-gold-light"
          >
            <Sparkles className="h-3.5 w-3.5" />
            The all-in-one restaurant OS
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="max-w-4xl font-display text-5xl font-semibold leading-[1.05] tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-7xl"
          >
            One table.
            <br />
            <span className="gold-gradient-text">Five worlds, live.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="mt-6 max-w-2xl text-base leading-relaxed text-zinc-500 dark:text-zinc-400 sm:text-lg"
          >
            Admins govern. Managers curate. The kitchen cooks in real time. Waiters
            serve on command. Customers order at the table — all synchronized
            instantly through a premium, immersive interface.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="mt-10 flex flex-col items-center gap-3 sm:flex-row"
          >
            <Link
              href="/login"
              className="group inline-flex h-12 items-center gap-2 rounded-full bg-gradient-to-r from-gold-light via-gold to-gold-dark px-8 text-base font-semibold text-zinc-950 shadow-[0_10px_40px_-10px_rgba(212,163,75,0.7)] transition-all hover:shadow-[0_14px_50px_-10px_rgba(212,163,75,0.9)]"
            >
              Enter the suite
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              href="#roles"
              className="inline-flex h-12 items-center rounded-full border border-zinc-200 dark:border-white/10 px-8 text-base font-medium text-zinc-600 dark:text-zinc-300 transition-colors hover:border-gold/50 hover:text-gold-dark dark:hover:text-gold-light"
            >
              Explore the roles
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.5 }}
            className="mt-16 grid w-full max-w-3xl grid-cols-2 gap-4 sm:grid-cols-4"
          >
            {[
              ["<1s", "real-time sync"],
              ["5", "dedicated roles"],
              ["100%", "table-to-kitchen"],
              ["24/7", "live service"],
            ].map(([v, l]) => (
              <div
                key={l}
                className="rounded-2xl border border-zinc-200 dark:border-white/[0.07] bg-zinc-100 dark:bg-white/[0.03] p-4 backdrop-blur-sm"
              >
                <p className="font-display text-2xl font-semibold text-gold-dark dark:text-gold-light">{v}</p>
                <p className="mt-1 text-xs text-zinc-500">{l}</p>
              </div>
            ))}
          </motion.div>
        </section>

        <section id="roles" className="pb-24">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.6 }}
            className="mb-10 text-center"
          >
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-gold-dark dark:text-gold-light">
              The ecosystem
            </p>
            <h2 className="font-display text-3xl font-semibold text-zinc-900 dark:text-zinc-50 sm:text-5xl">
              Every seat has a superpower
            </h2>
          </motion.div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {ROLES.map((role, i) => (
              <motion.div
                key={role.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="group relative overflow-hidden rounded-3xl border border-zinc-200 dark:border-white/[0.07] bg-gradient-to-br from-zinc-50 dark:from-white/[0.06] to-transparent dark:to-white/[0.01] p-6 backdrop-blur-sm transition-all hover:-translate-y-1 hover:border-gold/30"
              >
                <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-gold/10 blur-2xl transition-opacity opacity-0 group-hover:opacity-100" />
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-gold/10 text-gold-dark dark:text-gold-light ring-1 ring-gold/25">
                  <role.icon className="h-5 w-5" />
                </div>
                <h3 className="font-display text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  {role.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">{role.desc}</p>
              </motion.div>
            ))}
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-zinc-200 dark:border-white/[0.06] py-8 text-center text-xs text-zinc-600 dark:text-zinc-400">
        Plateform · Restaurant Management Suite — crafted for the modern table.
      </footer>
    </div>
  );
}
