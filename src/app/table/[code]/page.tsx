"use client";

import * as React from "react";
import { use } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Bell,
  BellRing,
  ChefHat,
  Check,
  CheckCircle2,
  Clock,
  Flame,
  Loader2,
  Minus,
  Package,
  Plus,
  ReceiptText,
  ShoppingBag,
  Sparkles,
  UtensilsCrossed,
  Wifi,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";
import { cn, formatCurrency, formatTime } from "@/lib/utils";
import { useRealtime } from "@/components/realtime/use-realtime";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { ThemeToggle } from "@/components/theme/theme-toggle";

type PublicItem = {
  id: string;
  name: string;
  description: string | null;
  ingredients: string;
  price: number;
  imageUrl: string | null;
  available: boolean;
  isPopular: boolean;
  categoryId: string | null;
  restaurantId: string;
};

type PublicMenu = {
  restaurant: { id: string; name: string; theme: string | null };
  table: { id: string; number: number; code: string };
  categories: { id: string; name: string; items: PublicItem[] }[];
  uncategorized: PublicItem[];
};

type CartLine = {
  menuItemId: string;
  name: string;
  price: number;
  imageUrl: string | null;
  qty: number;
};

type TrackedOrder = {
  id: string;
  orderNumber: number;
  status: string;
  type: "DINE_IN" | "TAKEAWAY";
  tableLabel: string;
  note: string | null;
  total: number;
  createdAt: string;
  items: { id: string; name: string; price: number; quantity: number; status: string }[];
  receipt: { subtotal: number; tax: number; total: number } | null;
};

const STATUS_STEPS = ["PENDING", "ACCEPTED", "COOKING", "READY", "SERVED"];

const stepMeta: Record<string, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  PENDING: { label: "Sent to kitchen", icon: Clock },
  ACCEPTED: { label: "Accepted", icon: ChefHat },
  COOKING: { label: "Being cooked", icon: Flame },
  READY: { label: "Ready for service", icon: Package },
  SERVED: { label: "Served", icon: CheckCircle2 },
};

function storageKey(code: string) {
  return `rms-orders-${code}`;
}

function loadOrders(code: string): TrackedOrder[] {
  try {
    return JSON.parse(sessionStorage.getItem(storageKey(code)) ?? "[]");
  } catch {
    return [];
  }
}

function saveOrders(code: string, orders: TrackedOrder[]) {
  try {
    sessionStorage.setItem(storageKey(code), JSON.stringify(orders));
  } catch {
    /* storage unavailable */
  }
}

export default function TableMenuPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);

  const [menu, setMenu] = React.useState<PublicMenu | null>(null);
  const [menuError, setMenuError] = React.useState<string | null>(null);
  const [loadingMenu, setLoadingMenu] = React.useState(true);
  const [activeCat, setActiveCat] = React.useState<string>("all");
  const [cart, setCart] = React.useState<CartLine[]>([]);
  const [cartOpen, setCartOpen] = React.useState(false);
  const [ordersOpen, setOrdersOpen] = React.useState(false);
  const [detail, setDetail] = React.useState<{ item: PublicItem; qty: number } | null>(null);
  const [orderType, setOrderType] = React.useState<"DINE_IN" | "TAKEAWAY">("DINE_IN");
  const [customerName, setCustomerName] = React.useState("");
  const [note, setNote] = React.useState("");
  const [placing, setPlacing] = React.useState(false);
  const [justPlaced, setJustPlaced] = React.useState<TrackedOrder | null>(null);
  const [bellState, setBellState] = React.useState<"idle" | "calling" | "ringing">("idle");
  const [orders, setOrders] = React.useState<TrackedOrder[]>(() =>
    typeof window === "undefined" ? [] : loadOrders(code)
  );

  const channels = React.useMemo(() => [{ scope: "table" as const, code }], [code]);

  const { connected } = useRealtime(channels, (evt) => {
    if (evt.type === "ORDER_UPDATE") {
      const p = evt.payload as {
        id: string;
        status?: string;
        receipt?: { subtotal: number; tax: number; total: number } | null;
        total?: number;
        orderNumber?: number;
      };
      if (p.id) {
        setOrders((prev) => {
          const next = prev.map((o) =>
            o.id === p.id
              ? {
                  ...o,
                  status: p.status ?? o.status,
                  receipt: p.receipt ?? o.receipt,
                  total: p.total ?? o.total,
                }
              : o
          );
          saveOrders(code, next);
          return next;
        });
      }
    }
    if (evt.type === "BELL") {
      setBellState("ringing");
    }
    if (evt.type === "BELL_RESOLVED") {
      setBellState("idle");
    }
  });

  async function refreshMenu() {
    setLoadingMenu(true);
    try {
      const res = await fetch(`/api/public/menu?code=${encodeURIComponent(code)}`);
      if (res.status === 404) {
        setMenuError("That table code doesn't exist. Check your QR code.");
      } else if (!res.ok) {
        setMenuError("Something went wrong loading the menu.");
      } else {
        setMenu(await res.json());
      }
    } catch {
      setMenuError("Network error — please try again.");
    } finally {
      setLoadingMenu(false);
    }
  }

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshMenu();
    fetch(`/api/bell?code=${encodeURIComponent(code)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.ringing) setBellState("ringing");
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const activeOrders = orders.filter((o) =>
    ["PENDING", "ACCEPTED", "COOKING", "READY"].includes(o.status)
  );
  const cartCount = cart.reduce((s, c) => s + c.qty, 0);
  const cartTotal = cart.reduce((s, c) => s + c.qty * c.price, 0);

  const visibleItems = React.useMemo(() => {
    if (!menu) return [];
    const uncat = menu.uncategorized ?? [];
    const items = menu.categories
      .filter((c) => activeCat === "all" || c.id === activeCat)
      .flatMap((c) => c.items);
    return activeCat === "all" ? [...uncat, ...items] : items;
  }, [menu, activeCat]);

  function addToCart(item: PublicItem, qty: number) {
    setCart((prev) => {
      const existing = prev.find((c) => c.menuItemId === item.id);
      if (existing) {
        return prev.map((c) =>
          c.menuItemId === item.id ? { ...c, qty: c.qty + qty } : c
        );
      }
      return [...prev, { menuItemId: item.id, name: item.name, price: item.price, imageUrl: item.imageUrl, qty }];
    });
    setDetail(null);
    toast.success(`${item.name} added to your order`);
  }

  function changeQty(menuItemId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((c) => (c.menuItemId === menuItemId ? { ...c, qty: c.qty + delta } : c))
        .filter((c) => c.qty > 0)
    );
  }

  async function placeOrder() {
    if (cart.length === 0) return;
    setPlacing(true);
    try {
      const res = await fetch("/api/orders/customer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          type: orderType,
          note: note.trim() || undefined,
          customerName: orderType === "TAKEAWAY" ? customerName.trim() || undefined : undefined,
          items: cart.map((c) => ({ menuItemId: c.menuItemId, quantity: c.qty })),
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Could not place order");

      const placed: TrackedOrder = {
        id: d.order.id,
        orderNumber: d.order.orderNumber,
        status: d.order.status,
        type: orderType,
        tableLabel: d.order.tableLabel,
        note: note.trim() || null,
        total: d.order.total,
        createdAt: d.order.createdAt,
        items: d.order.items,
        receipt: null,
      };
      setOrders((prev) => {
        const next = [placed, ...prev.filter((o) => o.id !== placed.id)];
        saveOrders(code, next);
        return next;
      });
      setCart([]);
      setNote("");
      setCartOpen(false);
      setJustPlaced(placed);
      setOrdersOpen(true);
      toast.success(`Order #${placed.orderNumber} sent to the kitchen`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not place order");
    } finally {
      setPlacing(false);
    }
  }

  async function ringBell() {
    if (bellState === "calling") return;
    setBellState("calling");
    try {
      const res = await fetch("/api/bell", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(d?.error ?? "Could not ring");
      }
      setBellState("ringing");
      toast.success("Your waiter has been notified");
    } catch (err) {
      setBellState("idle");
      toast.error(err instanceof Error ? err.message : "Could not ring the bell");
    }
  }

  if (loadingMenu) {
    return <CustomerSkeleton />;
  }

  if (menuError || !menu) {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-6 text-center">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-0 h-96 w-[600px] -translate-x-1/2 rounded-full bg-gold/[0.1] blur-[130px]" />
        </div>
        <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-gold to-gold-dark shadow-soft">
          <UtensilsCrossed className="h-8 w-8 text-zinc-950" />
        </div>
        <h1 className="mt-6 font-display text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          {menuError ?? "Menu unavailable"}
        </h1>
        <p className="mt-2 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
          Please ask a member of staff for help, or try scanning the QR code again.
        </p>
        <Button className="mt-6" onClick={refreshMenu}>
          Try again
        </Button>
      </div>
    );
  }

  const allCats = [
    { id: "all", name: "All" },
    ...menu.categories.map((c) => ({ id: c.id, name: c.name })),
  ];

  return (
    <div className="relative min-h-screen bg-background pb-32">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -top-40 left-1/2 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-gold/[0.08] blur-[140px]" />
      </div>

      <header className="sticky top-0 z-30 border-b border-zinc-200 dark:border-white/[0.06] bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-gold to-gold-dark shadow-[0_8px_30px_-8px_rgba(212,163,75,0.6)]">
              <UtensilsCrossed className="h-5 w-5 text-zinc-950" />
            </div>
            <div>
              <h1 className="font-display text-lg font-semibold leading-tight tracking-tight text-zinc-900 dark:text-zinc-50">
                {menu.restaurant.name}
              </h1>
              <div className="flex items-center gap-2">
                <span className="text-[11px] uppercase tracking-widest text-gold-dark dark:text-gold-light">
                  Table {menu.table.number}
                </span>
                <span className="flex items-center gap-1 text-[11px] text-zinc-500">
                  {connected ? (
                    <Wifi className="h-3 w-3 text-emerald-400" />
                  ) : (
                    <WifiOff className="h-3 w-3 text-zinc-600 dark:text-zinc-400" />
                  )}
                  {connected ? "live" : "offline"}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone="gold" className="hidden sm:inline-flex">
              <Sparkles className="h-3 w-3" /> Order from your seat
            </Badge>
            <ThemeToggle
              size="sm"
              className="border border-zinc-200 dark:border-white/10"
            />
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-5xl px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center pb-8 pt-10 text-center"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gold-dark dark:text-gold-light">
            {menu.restaurant.name}
          </p>
          <h2 className="mt-2 max-w-2xl font-display text-3xl font-semibold leading-tight text-zinc-900 dark:text-zinc-50 sm:text-4xl">
            Crafted to order, <span className="gold-gradient-text">served at your table</span>
          </h2>
          <p className="mt-3 max-w-lg text-sm text-zinc-500 dark:text-zinc-400">
            Browse the full menu with ingredients and prices, order in seconds,
            and ring the bell whenever you need us.
          </p>
        </motion.div>

        <div className="no-scrollbar sticky top-[73px] z-20 -mx-4 mb-6 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
          {allCats.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveCat(c.id)}
              className={cn(
                "shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-all",
                activeCat === c.id
                  ? "border-gold/60 bg-gold/10 text-gold-dark dark:text-gold-light shadow-[0_0_20px_-4px_rgba(212,163,75,0.4)]"
                  : "border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-white/[0.03] text-zinc-500 dark:text-zinc-400 hover:border-gold/30 hover:text-zinc-800 dark:hover:text-zinc-200"
              )}
            >
              {c.name}
            </button>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleItems.map((item, i) => (
            <motion.button
              key={item.id}
              type="button"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.1 }}
              transition={{ duration: 0.4, delay: Math.min(i * 0.05, 0.3) }}
              onClick={() => setDetail({ item, qty: 1 })}
              className="group relative overflow-hidden rounded-3xl border border-zinc-200 dark:border-white/[0.08] bg-gradient-to-br from-zinc-50 dark:from-white/[0.06] to-transparent dark:to-white/[0.01] text-left shadow-soft backdrop-blur-sm transition-all hover:-translate-y-1 hover:border-gold/30"
            >
              <div className="relative h-44 overflow-hidden">
                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-gold/15 to-transparent">
                    <UtensilsCrossed className="h-10 w-10 text-gold-dark/40 dark:text-gold-light/40" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-background/70 via-transparent to-transparent" />
                {item.isPopular && (
                  <div className="absolute left-3 top-3">
                    <Badge tone="gold">
                      <Flame className="h-3 w-3" /> Popular
                    </Badge>
                  </div>
                )}
                <span className="absolute bottom-3 right-3 rounded-full bg-black/60 px-3 py-1 font-display text-base font-semibold text-gold-light backdrop-blur-sm">
                  {formatCurrency(item.price)}
                </span>
              </div>

              <div className="p-4">
                <h3 className="font-display text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  {item.name}
                </h3>
                <p className="mt-1 line-clamp-2 text-sm text-zinc-500 dark:text-zinc-400">
                  {item.description ?? "—"}
                </p>
                <p className="mt-2 line-clamp-1 text-xs text-zinc-500">
                  <span className="text-zinc-600 dark:text-zinc-400">Ingredients:</span> {item.ingredients}
                </p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-[11px] uppercase tracking-wider text-gold-dark/70 dark:text-gold-light/70">
                    Tap to order
                  </span>
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gold/15 text-gold-dark dark:text-gold-light ring-1 ring-gold/25 transition-transform group-hover:scale-110">
                    <Plus className="h-4 w-4" />
                  </span>
                </div>
              </div>
            </motion.button>
          ))}

          {visibleItems.length === 0 && (
            <div className="col-span-full flex flex-col items-center py-16 text-center">
              <UtensilsCrossed className="mb-3 h-10 w-10 text-zinc-400 dark:text-zinc-700" />
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Nothing in this section yet.</p>
            </div>
          )}
        </div>
      </main>

      <AnimatePresence>
        {activeOrders.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            className="fixed inset-x-0 bottom-0 z-30 px-4 pb-4 sm:px-6"
          >
            <div className="mx-auto flex max-w-5xl items-center gap-3 rounded-2xl border border-gold/25 bg-background/90 px-4 py-3 shadow-soft backdrop-blur-xl">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold/15 text-gold-dark dark:text-gold-light ring-1 ring-gold/25">
                <ChefHat className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {activeOrders.length === 1
                    ? `Order #${activeOrders[0].orderNumber} is in the kitchen`
                    : `${activeOrders.length} orders cooking right now`}
                </p>
                <p className="text-xs text-zinc-500">Follow the progress live</p>
              </div>
              <Button size="sm" onClick={() => setOrdersOpen(true)}>
                Track
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 dark:border-white/[0.06] bg-background/90 px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 backdrop-blur-xl sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <button
            onClick={() => setOrdersOpen(true)}
            className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-white/[0.04] text-zinc-600 dark:text-zinc-300 transition-colors hover:text-gold-dark dark:hover:text-gold-light"
            aria-label="My orders"
          >
            <ReceiptText className="h-5 w-5" />
            {activeOrders.length > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-bold text-zinc-950">
                {activeOrders.length}
              </span>
            )}
          </button>

          <button
            onClick={ringBell}
            disabled={bellState === "calling"}
            className={cn(
              "relative flex h-12 shrink-0 items-center gap-2 rounded-2xl border px-4 text-sm font-semibold transition-all active:scale-[0.97]",
              bellState === "ringing"
                ? "border-gold/60 bg-gold/15 text-gold-dark dark:text-gold-light"
                : "border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-white/[0.04] text-zinc-800 dark:text-zinc-200 hover:border-gold/40 hover:text-gold-dark dark:hover:text-gold-light"
            )}
          >
            {bellState === "calling" ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : bellState === "ringing" ? (
              <BellRing className="h-5 w-5 animate-pulse-soft" />
            ) : (
              <Bell className="h-5 w-5" />
            )}
            <span className="hidden sm:inline">
              {bellState === "ringing" ? "Service requested" : "Call waiter"}
            </span>
            {bellState === "ringing" && (
              <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-gold animate-ping" />
            )}
          </button>

          <button
            onClick={() => setCartOpen(true)}
            disabled={cartCount === 0}
            className="flex h-12 flex-1 items-center justify-between gap-2 rounded-2xl bg-gradient-to-r from-gold-light via-gold to-gold-dark px-4 text-sm font-semibold text-zinc-950 shadow-[0_8px_30px_-8px_rgba(212,163,75,0.6)] transition-all hover:brightness-105 disabled:opacity-40"
          >
            <span className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5" />
              {cartCount > 0 ? `${cartCount} item${cartCount === 1 ? "" : "s"}` : "Your order"}
            </span>
            <span>
              {cartCount > 0 ? formatCurrency(cartTotal) : "Empty"}
            </span>
          </button>
        </div>
      </div>

      <Modal
        open={detail !== null}
        onClose={() => setDetail(null)}
        title={detail?.item.name}
        description="Fresh, made to order."
        className="max-w-md"
      >
        {detail && (
          <div>
            {detail.item.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={detail.item.imageUrl}
                alt={detail.item.name}
                className="h-56 w-full rounded-2xl object-cover"
              />
            ) : (
              <div className="flex h-40 w-full items-center justify-center rounded-2xl bg-gold/10">
                <UtensilsCrossed className="h-10 w-10 text-gold-dark/40 dark:text-gold-light/40" />
              </div>
            )}
            <p className="mt-4 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
              {detail.item.description ?? "—"}
            </p>
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Ingredients
              </p>
              <div className="flex flex-wrap gap-1.5">
                {detail.item.ingredients.split(",").map((ing) => (
                  <span
                    key={ing}
                    className="rounded-full border border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-white/[0.04] px-3 py-1 text-xs text-zinc-600 dark:text-zinc-300"
                  >
                    {ing.trim()}
                  </span>
                ))}
              </div>
            </div>
            <div className="mt-6 flex items-center justify-between border-t border-zinc-200 dark:border-white/[0.08] pt-5">
              <p className="font-display text-2xl font-semibold text-gold-dark dark:text-gold-light">
                {formatCurrency(detail.item.price)}
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() =>
                    setDetail((d) => (d ? { ...d, qty: Math.max(1, d.qty - 1) } : d))
                  }
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-white/[0.04] text-zinc-800 dark:text-zinc-200 transition-colors hover:border-gold/40"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-6 text-center font-display text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  {detail.qty}
                </span>
                <button
                  onClick={() => setDetail((d) => (d ? { ...d, qty: d.qty + 1 } : d))}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-white/[0.04] text-zinc-800 dark:text-zinc-200 transition-colors hover:border-gold/40"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
            <Button
              className="mt-4 w-full"
              size="lg"
              onClick={() => addToCart(detail.item, detail.qty)}
            >
              Add · {formatCurrency(detail.item.price * detail.qty)}
            </Button>
          </div>
        )}
      </Modal>

      <Modal
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        title="Your order"
        description={`Table ${menu.table.number} · ${menu.restaurant.name}`}
        className="max-w-md"
      >
        <div className="mb-5 grid grid-cols-2 gap-2">
          <button
            onClick={() => setOrderType("DINE_IN")}
            className={cn(
              "flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all",
              orderType === "DINE_IN"
                ? "border-gold/60 bg-gold/10 text-gold-dark dark:text-gold-light"
                : "border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-white/[0.03] text-zinc-500 dark:text-zinc-400"
            )}
          >
            <UtensilsCrossed className="h-4 w-4" /> Dine in
          </button>
          <button
            onClick={() => setOrderType("TAKEAWAY")}
            className={cn(
              "flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all",
              orderType === "TAKEAWAY"
                ? "border-gold/60 bg-gold/10 text-gold-dark dark:text-gold-light"
                : "border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-white/[0.03] text-zinc-500 dark:text-zinc-400"
            )}
          >
            <Package className="h-4 w-4" /> Takeaway
          </button>
        </div>

        {orderType === "TAKEAWAY" && (
          <div className="mb-4">
            <Label htmlFor="cust-name">Name for pickup</Label>
            <Input
              id="cust-name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Your name"
            />
          </div>
        )}

        <div className="space-y-2">
          {cart.map((c) => (
            <div
              key={c.menuItemId}
              className="flex items-center gap-3 rounded-xl border border-zinc-200 dark:border-white/[0.06] bg-zinc-100 dark:bg-white/[0.03] px-3 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{c.name}</p>
                <p className="text-xs text-zinc-500">{formatCurrency(c.price)} each</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => changeQty(c.menuItemId, -1)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-white/[0.04] text-zinc-600 dark:text-zinc-300 hover:border-gold/40"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="w-5 text-center text-sm font-semibold text-zinc-900 dark:text-zinc-100">{c.qty}</span>
                <button
                  onClick={() => changeQty(c.menuItemId, 1)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-white/[0.04] text-zinc-600 dark:text-zinc-300 hover:border-gold/40"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="w-16 text-right text-sm font-semibold text-gold-dark dark:text-gold-light">
                {formatCurrency(c.price * c.qty)}
              </p>
            </div>
          ))}
          {cart.length === 0 && (
            <p className="py-10 text-center text-sm text-zinc-500">
              Your cart is empty — browse the menu above.
            </p>
          )}
        </div>

        {cart.length > 0 && (
          <>
            <div className="mt-4">
              <Label htmlFor="order-note">Note for the kitchen (optional)</Label>
              <Textarea
                id="order-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. no onions, extra sauce…"
                rows={2}
              />
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-zinc-200 dark:border-white/[0.08] pt-4">
              <div>
                <p className="text-xs text-zinc-500">Total</p>
                <p className="font-display text-2xl font-semibold text-gold-dark dark:text-gold-light">
                  {formatCurrency(cartTotal)}
                </p>
              </div>
              <Button size="lg" onClick={placeOrder} disabled={placing}>
                {placing ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Check className="h-5 w-5" />
                )}
                {placing ? "Sending…" : "Place order"}
              </Button>
            </div>
          </>
        )}
      </Modal>

      <Modal
        open={ordersOpen}
        onClose={() => setOrdersOpen(false)}
        title="Your orders"
        description="Track every dish from the kitchen to your table — live."
        className="max-w-lg"
      >
        <div className="space-y-4">
          {orders.length === 0 && (
            <p className="py-10 text-center text-sm text-zinc-500">
              You haven&apos;t ordered anything yet.
            </p>
          )}
          {orders.map((o) => (
            <OrderTimeline key={o.id} order={o} highlight={o.id === justPlaced?.id} />
          ))}
        </div>
      </Modal>
    </div>
  );
}

function OrderTimeline({
  order,
  highlight,
}: {
  order: TrackedOrder;
  highlight?: boolean;
}) {
  const current = STATUS_STEPS.includes(order.status)
    ? STATUS_STEPS.indexOf(order.status)
    : order.status === "CANCELLED"
      ? -1
      : STATUS_STEPS.length;

  const done = order.status === "COMPLETED" || order.status === "CANCELLED";

  return (
    <div
      className={cn(
        "rounded-2xl border p-4",
        highlight
          ? "border-gold/40 bg-gold/[0.06] ring-2 ring-gold/20"
          : "border-zinc-200 dark:border-white/[0.07] bg-zinc-100 dark:bg-white/[0.02]"
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold/10 font-display text-sm font-bold text-gold-dark dark:text-gold-light ring-1 ring-gold/25">
            #{order.orderNumber}
          </span>
          <div>
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {order.tableLabel || (order.type === "TAKEAWAY" ? "Takeaway" : "Your table")}
            </p>
            <p className="text-xs text-zinc-500">{formatTime(order.createdAt)}</p>
          </div>
        </div>
        <Badge tone={done ? "zinc" : order.status === "CANCELLED" ? "rose" : "gold"}>
          {order.status}
        </Badge>
      </div>

      {!done ? (
        <div className="flex items-center">
          {STATUS_STEPS.map((step, i) => {
            const meta = stepMeta[step];
            const reached = i <= current;
            const isCurrent = i === current;
            const Icon = meta.icon;
            return (
              <React.Fragment key={step}>
                {i > 0 && (
                  <div
                    className={cn(
                      "mx-1 h-0.5 flex-1 rounded-full transition-colors",
                      i <= current ? "bg-gold/60" : "bg-zinc-200 dark:bg-white/10"
                    )}
                  />
                )}
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-full border transition-all",
                      reached
                        ? "border-gold/60 bg-gold/15 text-gold-dark dark:text-gold-light"
                        : "border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-white/[0.03] text-zinc-400 dark:text-zinc-600",
                      isCurrent && "ring-4 ring-gold/20"
                    )}
                  >
                    {isCurrent && i < current ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                  </div>
                  <span
                    className={cn(
                      "mt-1.5 hidden w-16 text-center text-[10px] leading-tight sm:block",
                      reached ? "text-gold-dark dark:text-gold-light" : "text-zinc-400 dark:text-zinc-600"
                    )}
                  >
                    {meta.label}
                  </span>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      ) : (
        <p className="text-center text-sm text-zinc-500">
          {order.status === "COMPLETED"
            ? "Enjoy your meal!"
            : "This order was cancelled."}
        </p>
      )}

      <div className="mt-4 space-y-1">
        {order.items.map((i) => (
          <div key={i.id} className="flex items-center justify-between text-sm">
            <span className="text-zinc-600 dark:text-zinc-300">
              <span className="mr-2 text-gold-dark dark:text-gold-light">{i.quantity}×</span>
              {i.name}
            </span>
            <span className="text-zinc-500 dark:text-zinc-400">{formatCurrency(i.price * i.quantity)}</span>
          </div>
        ))}
      </div>

      {order.receipt && (
        <div className="mt-4 rounded-xl border border-dashed border-gold/30 bg-white p-4 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100">
          <div className="mb-2 flex items-center justify-between border-b-2 border-dashed border-zinc-300 pb-2 dark:border-zinc-700">
            <p className="font-serif text-sm font-bold">YOUR RECEIPT</p>
            <p className="text-xs text-zinc-500">#{order.orderNumber}</p>
          </div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
              <span>Subtotal</span>
              <span>{formatCurrency(order.receipt.subtotal)}</span>
            </div>
            <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
              <span>Tax</span>
              <span>{formatCurrency(order.receipt.tax)}</span>
            </div>
            <div className="flex justify-between pt-1 text-base font-bold">
              <span>Total</span>
              <span>{formatCurrency(order.receipt.total)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CustomerSkeleton() {
  return (
    <div className="relative min-h-screen bg-background pb-32">
      <header className="border-b border-zinc-200 dark:border-white/[0.06] px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <div className="h-10 w-10 animate-pulse rounded-2xl bg-zinc-200 dark:bg-white/[0.06]" />
          <div className="space-y-2">
            <div className="h-4 w-40 animate-pulse rounded bg-zinc-200 dark:bg-white/[0.06]" />
            <div className="h-3 w-24 animate-pulse rounded bg-zinc-200 dark:bg-white/[0.06]" />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 pt-12 sm:px-6">
        <div className="mx-auto h-6 w-64 animate-pulse rounded bg-zinc-200 dark:bg-white/[0.06]" />
        <div className="mx-auto mt-4 h-3 w-80 max-w-full animate-pulse rounded bg-zinc-200 dark:bg-white/[0.06]" />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-72 animate-pulse rounded-3xl bg-zinc-200 dark:bg-white/[0.04]" />
          ))}
        </div>
      </main>
    </div>
  );
}
