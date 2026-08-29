"use client";

import * as React from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Bell,
  BellRing,
  Check,
  CheckCircle2,
  ChefHat,
  Grid3X3,
  Loader2,
  Minus,
  Package,
  Plus,
  Radio,
  ShoppingBag,
  UtensilsCrossed,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/stat-card";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Label, Textarea, Input, Select } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatCurrency, formatTime, timeAgo } from "@/lib/utils";
import { useRealtime } from "@/components/realtime/use-realtime";
import { useDebouncedCallback } from "@/lib/use-debounced";

type WaiterOrder = {
  id: string;
  orderNumber: number;
  status: string;
  type: "DINE_IN" | "TAKEAWAY";
  tableLabel: string;
  note: string | null;
  total: number;
  createdAt: string;
  items: { id: string; name: string; quantity: number; price: number }[];
  table: { number: number; code: string } | null;
  waiter: { id: string; name: string } | null;
  receipt: { subtotal: number; tax: number; total: number; discount?: number } | null;
};

type WaiterTable = {
  id: string;
  number: number;
  code: string;
  status: string;
  waiter: { id: string; name: string } | null;
  bellCalls: { id: string; createdAt: string }[];
  orders: {
    id: string;
    orderNumber: number;
    status: string;
    total: number;
    items: { id: string; name: string }[];
  }[];
};

type MenuItem = {
  id: string;
  name: string;
  price: number;
  imageUrl: string | null;
  isPopular: boolean;
  category: string | null;
};

const statusTone: Record<string, "amber" | "sky" | "violet" | "emerald" | "teal" | "rose" | "gold"> = {
  PENDING: "amber",
  TAKEN: "sky",
  PAID: "gold",
  ACCEPTED: "violet",
  COOKING: "violet",
  READY: "emerald",
  SERVED: "teal",
  CANCELLED: "rose",
};

export default function WaiterDashboard() {
  const [me, setMe] = React.useState<{ id: string; name: string } | null>(null);
  const [restaurantId, setRestaurantId] = React.useState<string | null>(null);
  const [tables, setTables] = React.useState<WaiterTable[]>([]);
  const [orders, setOrders] = React.useState<WaiterOrder[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [orderModal, setOrderModal] = React.useState<WaiterTable | null>(null);
  const [paymentOrder, setPaymentOrder] = React.useState<WaiterOrder | null>(null);

  async function refreshNow() {
    const [tRes, oRes] = await Promise.all([
      fetch("/api/tables"),
      fetch("/api/waiter/orders"),
    ]);
    if (tRes.ok) {
      const d = await tRes.json();
      setTables(d.tables ?? []);
    }
    if (oRes.ok) {
      const d = await oRes.json();
      setOrders(d.orders ?? []);
    }
    setLoading(false);
  }
  const refresh = useDebouncedCallback(refreshNow, 250);

  useRealtime(
    restaurantId ? [{ scope: "restaurant", id: restaurantId }] : [],
    (evt) => {
      if (evt.type === "BELL") playChime();
      refresh();
    }
  );

  React.useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/api/me").then((r) => r.json()),
      fetch("/api/tables").then((r) => r.json()),
      fetch("/api/waiter/orders").then((r) => r.json()),
    ])
      .then(([me, tData, oData]) => {
        if (!active) return;
        setMe(me.user ? { id: me.user.id, name: me.user.name } : null);
        setRestaurantId(me.user?.restaurantId ?? null);
        setTables(tData.tables ?? []);
        setOrders(oData.orders ?? []);
        setLoading(false);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const myTables = tables.filter((t) => t.waiter?.id === me?.id);
  const myOrders = orders.filter((o) => o.waiter?.id === me?.id);
  const bells = myTables.flatMap((t) =>
    t.bellCalls.map((b) => ({ ...b, table: t }))
  );
  const occupied = myTables.filter((t) => t.status === "occupied").length;
  const ready = myOrders.filter((o) => o.status === "READY");
  const inProgress = myOrders.filter((o) =>
    ["PENDING", "TAKEN", "PAID", "ACCEPTED", "COOKING"].includes(o.status)
  );

  async function act(orderId: string, action: string, label: string) {
    const toStatus =
      action === "take"
        ? "TAKEN"
        : action === "serve"
          ? "SERVED"
          : action === "cancel"
            ? "CANCELLED"
            : action === "complete"
              ? "COMPLETED"
              : undefined;
    if (toStatus) {
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: toStatus } : o))
      );
    }
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const d = await res.json();
      if (!res.ok) {
        toast.error(d.error ?? "Action failed");
        refresh();
        return;
      }
      toast.success(label);
    } catch {
      toast.error("Network error");
      refresh();
    }
  }

  async function answerBell(bellId: string) {
    try {
      const res = await fetch(`/api/bell/${bellId}`, { method: "PATCH" });
      if (!res.ok) throw new Error("Failed");
      toast.success("Bell answered");
      refresh();
    } catch {
      toast.error("Could not respond to bell");
    }
  }

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${me?.name?.split(" ")[0] ?? "Waiter"}`}
        description="Your tables and orders — synced live with the kitchen."
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="My tables" value={myTables.length} icon={Grid3X3} tone="text-sky-700 dark:text-sky-300 bg-sky-500/10" pulse={false} loading={loading} />
        <Stat label="Tables occupied" value={occupied} icon={UtensilsCrossed} tone="text-amber-700 dark:text-amber-300 bg-amber-500/10" pulse={false} loading={loading} />
        <Stat label="In progress" value={inProgress.length} icon={ChefHat} tone="text-violet-700 dark:text-violet-300 bg-violet-500/10" pulse={inProgress.length > 0} loading={loading} />
        <Stat label="Ready to serve" value={ready.length} icon={Package} tone="text-emerald-700 dark:text-emerald-300 bg-emerald-500/10" pulse={ready.length > 0} loading={loading} />
      </div>

      {bells.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 rounded-2xl border border-rose-400/30 bg-rose-500/[0.06] p-4"
        >
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-rose-700 dark:text-rose-300">
            <BellRing className="h-4 w-4 animate-pulse-soft" />
            {bells.length} bell{bells.length === 1 ? "" : "s"} ringing right now
          </div>
          <div className="flex flex-wrap gap-2">
            {bells.map((b) => (
              <button
                key={b.id}
                onClick={() => answerBell(b.id)}
                className="group flex items-center gap-2 rounded-full border border-rose-400/40 bg-rose-500/10 px-4 py-2 text-sm text-rose-700 dark:text-rose-200 transition-all hover:bg-rose-500/20"
              >
                <Bell className="h-4 w-4" />
                Table {b.table.number}
                <span className="text-xs text-rose-500 dark:text-rose-400">{timeAgo(b.createdAt)}</span>
                <span className="ml-1 rounded-full bg-rose-400/20 px-2 py-0.5 text-xs text-rose-700 dark:text-rose-100 transition-colors group-hover:bg-emerald-400/30 group-hover:text-emerald-700 dark:group-hover:text-emerald-100">
                  Answer
                </span>
              </button>
            ))}
          </div>
        </motion.div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              <Grid3X3 className="h-4 w-4 text-gold-dark dark:text-gold-light" /> My tables
            </h2>
            <span className="text-xs text-zinc-500">{myTables.length} total</span>
          </div>
          {loading ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-36" />
              ))}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {myTables.map((t) => {
                const active = t.orders[0];
                const bell = t.bellCalls[0];
                return (
                  <Card
                    key={t.id}
                    className="relative overflow-hidden p-4 transition-all hover:border-gold/30"
                  >
                    <span
                      className={cn(
                        "absolute inset-x-0 top-0 h-0.5",
                        bell
                          ? "bg-gradient-to-r from-rose-500 to-amber-400"
                          : t.status === "occupied"
                            ? "bg-gold"
                            : "bg-emerald-500/50"
                      )}
                    />
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-white/[0.05] font-display text-lg font-semibold text-zinc-900 dark:text-zinc-100 ring-1 ring-zinc-200 dark:ring-white/10">
                          {t.number}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Table {t.number}</p>
                          <Badge
                            tone={bell ? "rose" : t.status === "occupied" ? "amber" : "emerald"}
                            className="mt-1 capitalize"
                          >
                            {bell ? "Bell" : t.status}
                          </Badge>
                        </div>
                      </div>
                      <Button size="sm" onClick={() => setOrderModal(t)}>
                        <Plus className="h-4 w-4" /> Order
                      </Button>
                    </div>
                    {active && (
                      <div className="mt-3 rounded-xl bg-zinc-100 dark:bg-white/[0.04] px-3 py-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            Order <span className="font-semibold text-gold-dark dark:text-gold-light">#{active.orderNumber}</span>
                          </p>
                          <Badge tone={statusTone[active.status] ?? "amber"}>{active.status}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-zinc-500">
                          {active.items.length} item(s) ·{" "}
                          <span className="font-semibold text-zinc-600 dark:text-zinc-300">
                            {formatCurrency(active.total)}
                          </span>
                        </p>
                      </div>
                    )}
                  </Card>
                );
              })}
              {myTables.length === 0 && (
                <Card className="flex flex-col items-center justify-center py-12 text-center sm:col-span-2">
                  <Grid3X3 className="mb-3 h-8 w-8 text-zinc-600 dark:text-zinc-400" />
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">No tables assigned to you yet.</p>
                  <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                    Ask the manager to assign your tables.
                  </p>
                </Card>
              )}
            </div>
          )}
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              <Radio className="h-4 w-4 text-gold-dark dark:text-gold-light" /> Live orders
            </h2>
            <span className="text-xs text-zinc-500">{myOrders.length} active</span>
          </div>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-28" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence>
                {myOrders.map((o) => (
                  <OrderRow key={o.id} order={o} onAction={act} onCollect={setPaymentOrder} />
                ))}
              </AnimatePresence>
              {myOrders.length === 0 && (
                <Card className="flex flex-col items-center justify-center py-14 text-center">
                  <CheckCircle2 className="mb-3 h-8 w-8 text-emerald-600 dark:text-emerald-400/70" />
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">No active orders.</p>
                  <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                    New orders from your tables appear here instantly.
                  </p>
                </Card>
              )}
            </div>
          )}
        </section>
      </div>

      <PlaceOrderModal
        table={orderModal}
        onClose={() => setOrderModal(null)}
        onPlaced={() => {
          setOrderModal(null);
          refresh();
        }}
      />

      <CollectPaymentModal
        key={paymentOrder?.id ?? "none"}
        order={paymentOrder}
        onClose={() => setPaymentOrder(null)}
        onCollected={() => {
          setPaymentOrder(null);
          refresh();
        }}
      />
    </div>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
  tone,
  pulse,
  loading,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
  pulse: boolean;
  loading?: boolean;
}) {
  return (
    <Card className="flex items-center justify-between p-4">
      <div>
        <p className="text-xs uppercase tracking-wider text-zinc-500">{label}</p>
        {loading ? (
          <Skeleton className="mt-2 h-8 w-10" />
        ) : (
          <p className="mt-1 font-display text-3xl font-semibold text-zinc-900 dark:text-zinc-50">{value}</p>
        )}
      </div>
      <div className={cn("flex h-10 w-10 items-center justify-center rounded-2xl", tone)}>
        <Icon className={cn("h-5 w-5", pulse && "animate-pulse-soft")} />
      </div>
    </Card>
  );
}

function OrderRow({
  order,
  onAction,
  onCollect,
}: {
  order: WaiterOrder;
  onAction: (id: string, action: string, label: string) => void;
  onCollect: (order: WaiterOrder) => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      className={cn(
        "rounded-2xl border bg-gradient-to-br from-zinc-100 to-zinc-100 dark:from-white/[0.06] dark:to-white/[0.01] p-4 shadow-soft backdrop-blur-sm",
        order.status === "READY"
          ? "border-emerald-400/30 ring-1 ring-emerald-400/20"
          : "border-zinc-200 dark:border-white/10"
      )}
    >
      <div className="mb-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold/10 font-display text-sm font-bold text-gold-dark dark:text-gold-light ring-1 ring-gold/25">
            #{order.orderNumber}
          </span>
          <div>
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{order.tableLabel}</p>
            <p className="text-xs text-zinc-500">{formatTime(order.createdAt)}</p>
          </div>
        </div>
        <Badge tone={statusTone[order.status] ?? "amber"}>{order.status}</Badge>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {order.items.map((i) => (
          <span
            key={i.id}
            className="rounded-full border border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-white/[0.03] px-2.5 py-1 text-xs text-zinc-600 dark:text-zinc-300"
          >
            {i.quantity}× {i.name}
          </span>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-zinc-200 dark:border-white/[0.06] pt-3">
        <p className="text-sm font-semibold text-gold-dark dark:text-gold-light">{formatCurrency(order.total)}</p>
        <div className="flex gap-2">
          {order.status === "PENDING" && (
            <Button
              size="sm"
              variant="success"
              onClick={() => onAction(order.id, "take", `Order #${order.orderNumber} taken — sent to cashier`)}
            >
              <CheckCircle2 className="h-4 w-4" /> Take order
            </Button>
          )}
          {order.status === "READY" && (
            <Button size="sm" variant="success" onClick={() => onAction(order.id, "serve", `Order #${order.orderNumber} served`)}>
              <Check className="h-4 w-4" /> Serve
            </Button>
          )}
          {order.status === "SERVED" && (
            <Button size="sm" onClick={() => onCollect(order)}>
              <CheckCircle2 className="h-4 w-4" /> Complete
            </Button>
          )}
          {["PENDING", "TAKEN", "PAID", "ACCEPTED", "COOKING"].includes(order.status) && (
            <Button
              size="sm"
              variant="ghost"
              className="text-rose-700 dark:text-rose-300 hover:bg-rose-500/10"
              onClick={() => onAction(order.id, "cancel", `Order #${order.orderNumber} cancelled`)}
            >
              Cancel
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function PlaceOrderModal({
  table,
  onClose,
  onPlaced,
}: {
  table: WaiterTable | null;
  onClose: () => void;
  onPlaced: () => void;
}) {
  const [menu, setMenu] = React.useState<MenuItem[]>([]);
  const [menuLoading, setMenuLoading] = React.useState(false);
  const [cart, setCart] = React.useState<Record<string, { item: MenuItem; qty: number }>>({});
  const [cat, setCat] = React.useState("all");
  const [categories, setCategories] = React.useState<string[]>([]);
  const [note, setNote] = React.useState("");
  const [type, setType] = React.useState<"DINE_IN" | "TAKEAWAY">("DINE_IN");
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!table) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCart({});
    setCat("all");
    setNote("");
    setType("DINE_IN");
    setMenuLoading(true);
    fetch(`/api/public/menu?code=${encodeURIComponent(table.code)}`)
      .then((r) => r.json())
      .then((d) => {
        const items: MenuItem[] = [];
        const cats: string[] = [];
        for (const c of d.categories ?? []) {
          cats.push(c.name);
          items.push(
            ...c.items.map((i: MenuItem) => ({
              id: i.id,
              name: i.name,
              price: i.price,
              imageUrl: i.imageUrl,
              isPopular: i.isPopular,
              category: c.name,
            }))
          );
        }
        items.push(
          ...(d.uncategorized ?? []).map((i: MenuItem) => ({
            id: i.id,
            name: i.name,
            price: i.price,
            imageUrl: i.imageUrl,
            isPopular: i.isPopular,
            category: null,
          }))
        );
        setMenu(items);
        setCategories(cats);
      })
      .catch(() => toast.error("Could not load the menu"))
      .finally(() => setMenuLoading(false));
  }, [table]);

  const cartLines = Object.values(cart);
  const cartCount = cartLines.reduce((s, c) => s + c.qty, 0);
  const cartTotal = cartLines.reduce((s, c) => s + c.qty * c.item.price, 0);
  const visible = cat === "all" ? menu : menu.filter((i) => i.category === cat);

  function add(item: MenuItem) {
    setCart((prev) => {
      const existing = prev[item.id];
      return {
        ...prev,
        [item.id]: { item, qty: (existing?.qty ?? 0) + 1 },
      };
    });
  }

  function changeQty(id: string, delta: number) {
    setCart((prev) => {
      const next = { ...prev };
      const line = next[id];
      if (!line) return prev;
      const qty = line.qty + delta;
      if (qty <= 0) delete next[id];
      else next[id] = { ...line, qty };
      return next;
    });
  }

  async function submit() {
    if (cartCount === 0 || !table) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableId: table.id,
          type,
          note: note.trim() || undefined,
          items: cartLines.map((c) => ({ menuItemId: c.item.id, quantity: c.qty })),
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Could not place order");
      toast.success(`Order #${d.order.orderNumber} sent to the kitchen`);
      onPlaced();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not place order");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={table !== null}
      onClose={onClose}
      title={table ? `New order · Table ${table.number}` : "New order"}
      description="Build the order and send it straight to the kitchen."
      className="max-w-2xl"
    >
      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setType("DINE_IN")}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all",
            type === "DINE_IN"
              ? "border-gold/60 bg-gold/10 text-gold-dark dark:text-gold-light"
              : "border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-white/[0.03] text-zinc-500 dark:text-zinc-400"
          )}
        >
          <UtensilsCrossed className="h-4 w-4" /> Dine in
        </button>
        <button
          onClick={() => setType("TAKEAWAY")}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all",
            type === "TAKEAWAY"
              ? "border-gold/60 bg-gold/10 text-gold-dark dark:text-gold-light"
              : "border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-white/[0.03] text-zinc-500 dark:text-zinc-400"
          )}
        >
          <Package className="h-4 w-4" /> Takeaway
        </button>
      </div>

      {menuLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      ) : (
        <>
          <div className="no-scrollbar -mx-1 mb-3 flex gap-2 overflow-x-auto px-1">
            <button
              onClick={() => setCat("all")}
              className={cn(
                "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all",
                cat === "all"
                  ? "border-gold/60 bg-gold/10 text-gold-dark dark:text-gold-light"
                  : "border-zinc-200 dark:border-white/10 text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
              )}
            >
              All
            </button>
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCat(c)}
                className={cn(
                  "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all",
                  cat === c
                    ? "border-gold/60 bg-gold/10 text-gold-dark dark:text-gold-light"
                    : "border-zinc-200 dark:border-white/10 text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
                )}
              >
                {c}
              </button>
            ))}
          </div>

          <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
            {visible.map((item) => {
              const line = cart[item.id];
              return (
                <div
                  key={item.id}
                  className="flex items-center gap-3 rounded-xl border border-zinc-200 dark:border-white/[0.06] bg-zinc-100 dark:bg-white/[0.02] px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{item.name}</p>
                    <p className="text-xs text-gold-dark dark:text-gold-light">{formatCurrency(item.price)}</p>
                  </div>
                  {line ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => changeQty(item.id, -1)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-zinc-300 hover:border-rose-400/40 hover:text-rose-700 dark:hover:text-rose-300"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-5 text-center text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        {line.qty}
                      </span>
                      <button
                        onClick={() => add(item)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-zinc-300 hover:border-gold/40 hover:text-gold-dark dark:hover:text-gold-light"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <Button size="sm" variant="subtle" onClick={() => add(item)}>
                      <Plus className="h-3.5 w-3.5" /> Add
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {cartCount > 0 && (
        <>
          <div className="mt-4">
            <Label htmlFor="wo-note">Note for the kitchen</Label>
            <Textarea
              id="wo-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. well done, no onions…"
              rows={2}
            />
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-zinc-200 dark:border-white/[0.08] pt-4">
            <div>
              <p className="text-xs text-zinc-500">
                {cartCount} item{cartCount === 1 ? "" : "s"}
              </p>
              <p className="font-display text-2xl font-semibold text-gold-dark dark:text-gold-light">
                {formatCurrency(cartTotal)}
              </p>
            </div>
            <Button size="lg" onClick={submit} disabled={submitting}>
              {submitting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <ShoppingBag className="h-5 w-5" />
              )}
              {submitting ? "Sending…" : "Send to kitchen"}
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}

function CollectPaymentModal({
  order,
  onClose,
  onCollected,
}: {
  order: WaiterOrder | null;
  onClose: () => void;
  onCollected: () => void;
}) {
  const [cashReceived, setCashReceived] = React.useState("");
  const [paymentMethod, setPaymentMethod] = React.useState("CASH");
  const [discount, setDiscount] = React.useState("");
  const [discountReason, setDiscountReason] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const subtotal = order
    ? (order.receipt?.subtotal ?? order.items.reduce((s, i) => s + i.price * i.quantity, 0))
    : 0;
  const discountValue = Math.min(Math.max(Number(discount) || 0, 0), subtotal);
  const taxable = Math.max(0, subtotal - discountValue);
  const tax = Math.round(taxable * 0.08 * 100) / 100;
  const total = Math.round((taxable + tax) * 100) / 100;
  const isCash = paymentMethod === "CASH";
  const tendered = Number(cashReceived) || 0;
  const hasTendered = isCash ? cashReceived.trim() !== "" && Number.isFinite(tendered) && tendered >= 0 : true;
  const collected = isCash ? tendered : total;
  const change = isCash && tendered > 0 ? Math.max(0, Math.round((tendered - total) * 100) / 100) : null;
  const tip = collected > 0 && collected >= total ? Math.max(0, Math.round((collected - total) * 100) / 100) : 0;
  const canSubmit = !!order && hasTendered && (isCash ? tendered >= total : true);

  async function complete() {
    if (!order || !canSubmit) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "complete",
          collectedAmount: collected,
          discount: discountValue,
          discountReason: discountReason.trim() || null,
          paymentMethod,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        toast.error(d.error ?? "Could not complete the order");
        return;
      }
      toast.success(
        `Order #${order.orderNumber} paid ${formatCurrency(total)} · tip ${formatCurrency(tip)}`
      );
      onCollected();
    } catch {
      toast.error("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={order !== null}
      onClose={onClose}
      title={order ? `Collect payment · #${order.orderNumber}` : "Collect payment"}
      description="Runs after the customer is served and finishes eating."
    >
      {order && (
        <>
          <div className="mb-5 rounded-2xl border border-zinc-200 dark:border-white/[0.06] bg-zinc-100 dark:bg-white/[0.03] p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {order.tableLabel}
                </p>
                <p className="text-xs text-zinc-500">
                  {order.items.reduce((s, i) => s + i.quantity, 0)} item(s) ·{" "}
                  {formatCurrency(subtotal)}
                </p>
              </div>
              <Badge tone="teal">SERVED</Badge>
            </div>
            <div className="mt-3 space-y-1 border-t border-zinc-200 dark:border-white/[0.06] pt-3 text-sm">
              <div className="flex justify-between text-zinc-500">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              {discountValue > 0 && (
                <div className="flex justify-between text-rose-600">
                  <span>Discount{discountReason.trim() ? ` (${discountReason.trim()})` : ""}</span>
                  <span>−{formatCurrency(discountValue)}</span>
                </div>
              )}
              <div className="flex justify-between text-zinc-500">
                <span>Tax (8%)</span>
                <span>{formatCurrency(tax)}</span>
              </div>
              <div className="flex items-end justify-between pt-1">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Customer pays (incl. tax)</p>
                <p className="font-display text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
                  {formatCurrency(total)}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <Label htmlFor="wp-discount">Discount (ETB)</Label>
              <Input
                id="wp-discount"
                type="number"
                min={0}
                step="0.01"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label htmlFor="wp-reason">Discount reason</Label>
              <Input
                id="wp-reason"
                value={discountReason}
                onChange={(e) => setDiscountReason(e.target.value)}
                placeholder="e.g. loyalty, complaint, promo"
              />
            </div>
            <div>
              <Label htmlFor="wp-method">Payment method</Label>
              <Select id="wp-method" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                <option value="CASH">Cash</option>
                <option value="CARD">Card (POS)</option>
                <option value="CARD_ONLINE">Online card</option>
                <option value="OTHER">Other</option>
              </Select>
            </div>
            {isCash && (
              <div>
                <Label htmlFor="wp-cash">Cash tendered</Label>
                <Input
                  id="wp-cash"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={cashReceived}
                  onChange={(e) => setCashReceived(e.target.value)}
                  placeholder="0.00"
                  autoFocus
                />
                {hasTendered && tendered < total && (
                  <p className="mt-1 text-xs text-rose-500">
                    Cash tendered is less than {formatCurrency(total)}.
                  </p>
                )}
              </div>
            )}

            {change !== null && (
              <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-4 py-3 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:ring-emerald-500/20">
                <p className="text-sm text-emerald-700 dark:text-emerald-200">Change</p>
                <p className="font-display text-xl font-semibold text-emerald-700 dark:text-emerald-200">
                  {formatCurrency(change)}
                </p>
              </div>
            )}

            <div className="flex items-center justify-between rounded-xl bg-gold/[0.07] px-4 py-3 ring-1 ring-gold/20">
              <p className="text-sm text-zinc-600 dark:text-zinc-300">Your tip</p>
              <p className="font-display text-xl font-semibold text-gold-dark dark:text-gold-light">
                {formatCurrency(tip)}
              </p>
            </div>
          </div>

          <div className="mt-5">
            <Button
              size="lg"
              className="w-full"
              onClick={() => complete()}
              disabled={submitting || !canSubmit}
            >
              {submitting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-5 w-5" />
              )}
              Collect {formatCurrency(total)}
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}

let audioCtx: AudioContext | null = null;
function playChime() {
  try {
    audioCtx = audioCtx ?? new AudioContext();
    const ctx = audioCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 660;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.45);
  } catch {
    /* audio unavailable */
  }
}
