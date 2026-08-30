"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  Bell,
  BellRing,
  Crown,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  RotateCcw,
  ScrollText,
  Settings,
  UtensilsCrossed,
  Wifi,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useRealtime, type RealtimeChannel } from "@/components/realtime/use-realtime";
import { useBrowserNotify } from "@/components/realtime/use-browser-notify";
import { Avatar } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme/theme-toggle";

export const NAV_ICONS = {
  LayoutDashboard,
  Store: LayoutDashboard,
  Users: LayoutDashboard,
  BarChart3: LayoutDashboard,
  Radio: LayoutDashboard,
  BellRing,
  ListChecks: LayoutDashboard,
  ReceiptText: LayoutDashboard,
  UtensilsCrossed,
  Package,
  Grid3X3: LayoutDashboard,
  Wallet: LayoutDashboard,
  Coins: LayoutDashboard,
  RotateCcw,
  ScrollText,
  Settings,
} as const;

export type NavItem = {
  label: string;
  href: string;
  icon: keyof typeof NAV_ICONS;
};

const ROLE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  OWNER: Crown,
  MANAGER: LayoutDashboard,
  KITCHEN: UtensilsCrossed,
  WAITER: UtensilsCrossed,
  CASHIER: UtensilsCrossed,
};

function RestaurantLogo({
  logoUrl,
  size = "md",
}: {
  logoUrl?: string | null;
  size?: "sm" | "md";
}) {
  const wrap = size === "sm" ? "h-8 w-8 rounded-xl" : "h-11 w-11 rounded-2xl";
  const icon = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  const shadow = "shadow-[0_8px_30px_-8px_rgba(212,163,75,0.6)]";
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt="Restaurant logo"
        className={`${wrap} shrink-0 border border-white/10 object-cover ${shadow}`}
        loading="lazy"
      />
    );
  }
  return (
    <div
      className={`${wrap} flex shrink-0 items-center justify-center bg-gradient-to-br from-gold to-gold-dark ${shadow}`}
    >
      <UtensilsCrossed className={`${icon} text-zinc-950`} />
    </div>
  );
}

const NOTIFY_TOAST: Record<string, { title: string; tone: "default" | "success" | "error" }> = {
  ORDER_NEW: { title: "New order", tone: "success" },
  ORDER_READY: { title: "Order ready", tone: "success" },
  ORDER_CUSTOMER: { title: "Customer ordered", tone: "default" },
  BELL: { title: "Service bell", tone: "default" },
  ORDER_STATUS: { title: "Order update", tone: "default" },
  MENU_UPDATE: { title: "Menu updated", tone: "default" },
  BRANCH_APPROVED: { title: "Branch approved", tone: "success" },
  BRANCH_REJECTED: { title: "Branch request declined", tone: "error" },
  BRANCH_REQUEST_NEW: { title: "New branch request", tone: "default" },
  BRANCH_CREATED: { title: "Branch created", tone: "success" },
  USER_CREATED: { title: "Employee added", tone: "success" },
  USER_UPDATED: { title: "Employee updated", tone: "default" },
  USER_DELETED: { title: "Employee removed", tone: "error" },
};

export function PortalShell({
  user,
  restaurantName,
  restaurantLogo,
  nav,
  children,
}: {
  user: {
    id: string;
    name: string;
    phone: string;
    role: string;
    restaurantId: string | null;
  };
  restaurantName: string | null;
  restaurantLogo?: string | null;
  nav: NavItem[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [bellOpen, setBellOpen] = React.useState(false);
  const [notifs, setNotifs] = React.useState<
    { id: string; title: string; body: string; type: string; read: boolean; createdAt: string }[]
  >([]);
  const [unread, setUnread] = React.useState(0);

  const { permission, notifyBrowser, requestPermission, unsubscribeAll } = useBrowserNotify();

  const channels = React.useMemo<RealtimeChannel[]>(() => {
    const c: RealtimeChannel[] = [];
    if (user.restaurantId) c.push({ scope: "restaurant", id: user.restaurantId });
    c.push({ scope: "user", id: user.id });
    return c;
  }, [user.id, user.restaurantId]);

  const { connected } = useRealtime(channels, (evt) => {
    const map = NOTIFY_TOAST[evt.type];
    if (map) {
      const payload = evt.payload as { title?: string; body?: string; id?: string };
      if (typeof document !== "undefined" && !document.hasFocus()) notifyBrowser(payload.title ?? map.title, { body: payload.body ?? "" });
      if (map.tone === "success") toast.success(payload.title ?? map.title);
      else if (map.tone === "error") toast.error(payload.title ?? map.title);
      else toast(payload.title ?? map.title, { description: payload.body ?? "" });
    }
    if (evt.type !== "heartbeat" && evt.type !== "hello") {
      setNotifs((prev) => [
        {
          id: evt.id,
          title: (evt.payload as { title?: string })?.title ?? evt.type,
          body: (evt.payload as { body?: string })?.body ?? "",
          type: evt.type,
          read: false,
          createdAt: new Date(evt.createdAt).toISOString(),
        },
        ...prev,
      ]);
      setUnread((u) => u + 1);
    }
  });

  React.useEffect(() => {
    fetch("/api/notifications")
      .then((r) => r.json())
      .then((d) => {
        setNotifs(d.notifications ?? []);
        setUnread(d.unread ?? 0);
      })
      .catch(() => {});
  }, []);

  const markRead = React.useCallback(async () => {
    await fetch("/api/notifications", { method: "POST" }).catch(() => {});
    setUnread(0);
    setNotifs((n) => n.map((x) => ({ ...x, read: true })));
  }, []);

  const logout = React.useCallback(async () => {
    await unsubscribeAll();
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }, [router, unsubscribeAll]);

  const RoleIcon = ROLE_ICON[user.role] ?? LayoutDashboard;

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-6 pb-6 pt-7">
        <RestaurantLogo logoUrl={restaurantLogo} />
        <div>
          <p className="font-display text-lg font-semibold leading-none tracking-tight">
            <span className="gold-gradient-text">Plateform</span>
          </p>
          <p className="mt-1 text-[11px] uppercase tracking-widest text-zinc-500 dark:text-zinc-500">
            {restaurantName ?? "System Admin"}
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {nav.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = NAV_ICONS[item.icon] ?? LayoutDashboard;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setDrawerOpen(false)}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all",
                active
                  ? "bg-gold/10 text-gold-dark dark:text-gold-light"
                  : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-zinc-100"
              )}
            >
              {active && (
                <motion.span
                  layoutId="nav-active"
                  className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-full bg-gradient-to-b from-gold-light to-gold"
                />
              )}
              <Icon className="h-[18px] w-[18px]" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-2 px-4 pb-5">
        <Link
          href="/account/password"
          onClick={() => setDrawerOpen(false)}
          className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-zinc-100"
        >
          <KeyRound className="h-[18px] w-[18px]" />
          Change password
        </Link>

        <div className="rounded-2xl border border-zinc-200 bg-zinc-100/60 p-3 dark:border-white/10 dark:bg-white/[0.03]">
          <div className="flex items-center gap-3">
            <Avatar name={user.name} className="h-9 w-9 text-xs" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{user.name}</p>
              <p className="truncate text-xs text-zinc-500">{user.phone}</p>
            </div>
            <button
              onClick={logout}
              className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-200 hover:text-rose-600 dark:hover:bg-white/10 dark:hover:text-rose-300"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background lg:pl-[260px]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[260px] border-r border-zinc-200 bg-surface/90 backdrop-blur-xl lg:block dark:border-white/[0.06] dark:bg-[#0d0d0f]/90">
        {sidebar}
      </aside>

      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
              onClick={() => setDrawerOpen(false)}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed inset-y-0 left-0 z-50 w-[280px] border-r border-zinc-200 bg-surface lg:hidden dark:border-white/10 dark:bg-[#0d0d0f]"
            >
              {sidebar}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-zinc-200 bg-background/80 px-4 backdrop-blur-xl sm:px-6 dark:border-white/[0.06] dark:bg-[#0a0a0b]/80">
        <button
          onClick={() => setDrawerOpen(true)}
          className="rounded-xl p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-white lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2.5 lg:hidden">
          <RestaurantLogo logoUrl={restaurantLogo} size="sm" />
          <p className="font-display text-base font-semibold">
            <span className="gold-gradient-text">Plateform</span>
          </p>
        </div>

        <div className="ml-auto flex items-center gap-2.5">
          <ThemeToggle size="sm" className="hidden sm:inline-flex" />

          <Badge
            tone={connected ? "emerald" : "zinc"}
            className="hidden sm:inline-flex"
          >
            {connected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {connected ? "Live" : "Offline"}
          </Badge>

          {permission !== "granted" && permission !== "denied" && permission !== "unsupported" && (
            <button
              onClick={requestPermission}
              className="relative flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-zinc-100/60 px-3 py-2 text-xs font-medium text-zinc-600 transition-colors hover:border-gold/40 hover:text-gold-dark dark:border-white/10 dark:bg-white/[0.03] dark:text-zinc-300 dark:hover:text-gold-light"
              title="Enable push notifications"
            >
              <BellRing className="h-4 w-4 text-gold-dark dark:text-gold-light" />
              <span className="hidden sm:inline">Enable push</span>
            </button>
          )}

          <div className="relative">
            <button
              onClick={() => {
                setBellOpen((o) => !o);
                if (unread > 0) markRead();
              }}
              className="relative rounded-xl p-2.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-white/5 dark:hover:text-white"
            >
              <Bell className="h-5 w-5" />
              {unread > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-gradient-to-br from-rose-500 to-rose-600 px-1 text-[10px] font-bold text-white shadow-[0_0_12px_rgba(244,63,94,0.6)]">
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </button>
            <AnimatePresence>
              {bellOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 mt-2 w-80 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl backdrop-blur-xl sm:w-96 dark:border-white/10 dark:bg-zinc-950/95 dark:shadow-soft"
                >
                  <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-white/[0.06]">
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Notifications</p>
                    <button
                      onClick={markRead}
                      className="text-xs text-gold-dark hover:underline dark:text-gold-light"
                    >
                      Mark all read
                    </button>
                  </div>
                  <div className="max-h-[360px] overflow-y-auto">
                    {notifs.length === 0 ? (
                      <p className="px-4 py-8 text-center text-sm text-zinc-500">
                        You&apos;re all caught up.
                      </p>
                    ) : (
                      notifs.map((n) => (
                        <div
                          key={n.id}
                          className={cn(
                            "border-b border-zinc-200/70 px-4 py-3 transition-colors hover:bg-zinc-100/70 dark:border-white/[0.04] dark:hover:bg-white/[0.03]",
                            !n.read && "bg-gold/[0.05]"
                          )}
                        >
                          <div className="flex items-start gap-2.5">
                            {!n.read && (
                              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-gold" />
                            )}
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{n.title}</p>
                              <p className="mt-0.5 line-clamp-2 text-xs text-zinc-500 dark:text-zinc-400">{n.body}</p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="hidden items-center gap-2.5 sm:flex">
            {restaurantLogo ? (
              <RestaurantLogo logoUrl={restaurantLogo} size="sm" />
            ) : (
              <Avatar name={user.name} className="h-8 w-8 text-xs" />
            )}
            <div className="leading-tight">
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{user.name}</p>
              <p className="text-[11px] capitalize text-zinc-500">{user.role.toLowerCase()}</p>
            </div>
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 dark:bg-white/5 sm:hidden">
            <RoleIcon className="h-4 w-4 text-gold-dark dark:text-gold-light" />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
