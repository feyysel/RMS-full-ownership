"use client";

import * as React from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Check,
  CookingPot,
  Flame,
  Clock,
  ChefHat,
  ReceiptText,
  Package,
  Bell,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatTime } from "@/lib/utils";
import { useRealtime } from "@/components/realtime/use-realtime";
import { useDebouncedCallback } from "@/lib/use-debounced";

type Order = {
  id: string;
  orderNumber: number;
  status: "PAID" | "ACCEPTED" | "COOKING" | "READY" | "SERVED" | "COMPLETED";
  type: "DINE_IN" | "TAKEAWAY";
  tableLabel: string;
  note: string | null;
  createdAt: string;
  items: { id: string; name: string; quantity: number; price: number }[];
  table: { number: number; code: string } | null;
  waiter: { id: string; name: string } | null;
};

type QueueData = {
  active: Order[];
  recent: (Order & { receipt: { id: string; total: number } | null })[];
  counts: Record<string, number>;
};

export default function KitchenPage() {
  const [data, setData] = React.useState<QueueData | null>(null);
  const [restaurantId, setRestaurantId] = React.useState<string | null>(null);
  const [receiptFor, setReceiptFor] = React.useState<Order | null>(null);
  const [newOrderId, setNewOrderId] = React.useState<string | null>(null);

  const refreshNow = React.useCallback(async () => {
    const res = await fetch("/api/kitchen/queue");
    if (res.ok) setData(await res.json());
  }, []);
  const refresh = useDebouncedCallback(refreshNow, 500);

  useRealtime(
    restaurantId ? [{ scope: "restaurant", id: restaurantId }] : [],
    React.useCallback(
      (evt: { type: string; payload: unknown }) => {
        if (evt.type === "ORDER_NEW") {
          const p = evt.payload as { id?: string };
          if (p.id) {
            setNewOrderId(p.id);
            setTimeout(() => setNewOrderId(null), 4000);
          }
          playChime();
        }
        refresh();
      },
      [refresh]
    )
  );

  React.useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => setRestaurantId(d.user?.restaurantId ?? null))
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    refreshNow();
  }, [refreshNow]);

  const act = React.useCallback(async (orderId: string, action: "accept" | "cook" | "ready") => {
    const labels: Record<string, string> = {
      accept: "Order accepted — start prepping",
      cook: "Now cooking",
      ready: "Order ready — send to waiter",
    };
    const toStatus = { accept: "ACCEPTED", cook: "COOKING", ready: "READY" } as const;

    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        active: prev.active.map((o) =>
          o.id === orderId ? { ...o, status: toStatus[action] } : o
        ),
        recent: prev.recent.map((o) =>
          o.id === orderId ? { ...o, status: toStatus[action] } : o
        ),
      };
    });

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
      toast.success(labels[action]);
    } catch {
      toast.error("Network error");
      refresh();
    }
  }, [refresh]);

  const queue = data?.active ?? [];
  const paid = queue.filter((o) => o.status === "PAID");
  const accepted = queue.filter((o) => o.status === "ACCEPTED");
  const cooking = queue.filter((o) => o.status === "COOKING");
  const ready = queue.filter((o) => o.status === "READY");
  const recent = (data?.recent ?? []).filter((o) => o.status !== "READY");

  return (
    <div>
      <PageHeader
        title="Kitchen Queue"
        description="First come, first served. Accept, cook, and release orders — all in real time."
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "To accept", value: paid.length, tone: "bg-sky-400", pulse: paid.length > 0 },
          { label: "Accepted", value: accepted.length, tone: "bg-violet-400", pulse: false },
          { label: "Cooking", value: cooking.length, tone: "bg-teal-400", pulse: cooking.length > 0 },
          { label: "Ready", value: ready.length, tone: "bg-emerald-400", pulse: ready.length > 0 },
        ].map((s) => (
          <Card key={s.label} className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs uppercase tracking-wider text-zinc-500">{s.label}</p>
              {data ? (
                <p className="mt-1 font-display text-3xl font-semibold text-zinc-900 dark:text-zinc-50">{s.value}</p>
              ) : (
                <Skeleton className="mt-2 h-8 w-10" />
              )}
            </div>
            <span className={`h-3 w-3 rounded-full ${s.tone} ${s.pulse ? "animate-pulse-soft" : ""}`} />
          </Card>
        ))}
      </div>

      <AnimatePresence>
        {newOrderId && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mb-4 flex items-center gap-3 rounded-2xl border border-gold/40 bg-gold/10 px-4 py-3"
          >
            <Bell className="h-5 w-5 animate-pulse-soft text-gold-dark dark:text-gold-light" />
            <p className="flex-1 text-sm font-medium text-gold-dark dark:text-gold-light">
              New order incoming — check the queue!
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-4">
        {data && queue.length === 0 && (
          <Card className="flex flex-col items-center justify-center py-20 text-center">
            <ChefHat className="mb-4 h-12 w-12 text-zinc-700" />
            <p className="font-display text-xl font-semibold text-zinc-800 dark:text-zinc-200">Kitchen is clear</p>
            <p className="mt-1 text-sm text-zinc-500">
              New orders will appear here the instant they&apos;re placed.
            </p>
          </Card>
        )}

        {!data ? (
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-56" />
            ))}
          </div>
        ) : (
          <>
            {paid.length > 0 && (
              <section>
                <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-sky-700 dark:text-sky-300">
                  <Bell className="h-4 w-4" /> Paid &amp; waiting · accept to start
                </h2>
                <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                  {paid.map((o) => (
                    <OrderCard key={o.id} order={o} highlight={o.id === newOrderId}>
                      <div className="flex gap-2">
                        <Button onClick={() => act(o.id, "accept")} className="flex-1">
                          <Check className="h-4 w-4" /> Accept order
                        </Button>
                      </div>
                    </OrderCard>
                  ))}
                </div>
              </section>
            )}

            {accepted.length > 0 && (
              <section>
                <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-sky-700 dark:text-sky-300">
                  <Clock className="h-4 w-4" /> Accepted
                </h2>
                <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                  {accepted.map((o) => (
                    <OrderCard key={o.id} order={o}>
                      <Button variant="success" onClick={() => act(o.id, "cook")} className="flex-1">
                        <CookingPot className="h-4 w-4" /> Start cooking
                      </Button>
                    </OrderCard>
                  ))}
                </div>
              </section>
            )}

            {cooking.length > 0 && (
              <section>
                <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-violet-700 dark:text-violet-300">
                  <Flame className="h-4 w-4" /> On the stove
                </h2>
                <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                  {cooking.map((o) => (
                    <OrderCard key={o.id} order={o} cooking>
                      <Button variant="success" onClick={() => act(o.id, "ready")} className="flex-1">
                        <Check className="h-4 w-4" /> Done — send to waiter
                      </Button>
                    </OrderCard>
                  ))}
                </div>
              </section>
            )}

            {ready.length > 0 && (
              <section>
                <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                  <Package className="h-4 w-4" /> Ready for pickup
                </h2>
                <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                  {ready.map((o) => (
                    <OrderCard key={o.id} order={o}>
                      <Button variant="outline" onClick={() => setReceiptFor(o)} className="flex-1">
                        <ReceiptText className="h-4 w-4" /> View receipt
                      </Button>
                    </OrderCard>
                  ))}
                </div>
              </section>
            )}

            {recent.length > 0 && (
              <section className="pt-2">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500">
                  Recently completed
                </h2>
                <div className="flex flex-wrap gap-2">
                  {recent.map((o) => (
                    <Badge key={o.id} tone={o.status === "COMPLETED" ? "zinc" : "teal"}>
                      #{o.orderNumber} · {o.tableLabel}
                    </Badge>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      <Modal
        open={receiptFor !== null}
        onClose={() => setReceiptFor(null)}
        title={`Receipt · Order #${receiptFor?.orderNumber}`}
        description={`Generated for ${receiptFor?.tableLabel}`}
      >
        {receiptFor && <ReceiptContent order={receiptFor} />}
      </Modal>
    </div>
  );
}

function OrderCard({
  order,
  children,
  highlight,
  cooking,
}: {
  order: Order;
  children: React.ReactNode;
  highlight?: boolean;
  cooking?: boolean;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={
        "rounded-2xl border bg-gradient-to-br from-zinc-100 to-zinc-100 p-5 shadow-soft backdrop-blur-sm dark:from-white/[0.06] dark:to-white/[0.01] " +
        (highlight
          ? "border-gold/50 ring-2 ring-gold/30"
          : cooking
            ? "border-violet-400/30"
            : "border-zinc-200 dark:border-white/10")
      }
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold/10 font-display text-sm font-bold text-gold-dark ring-1 ring-gold/25 dark:text-gold-light">
            #{order.orderNumber}
          </div>
          <div>
            <p className="font-medium text-zinc-900 dark:text-zinc-100">{order.tableLabel}</p>
            <p className="text-xs text-zinc-500">
              {formatTime(order.createdAt)} · {order.waiter?.name ?? "Customer"}
            </p>
          </div>
        </div>
        <Badge tone={order.type === "TAKEAWAY" ? "sky" : "amber"}>
          {order.type === "TAKEAWAY" ? "Takeaway" : "Dine-in"}
        </Badge>
      </div>

      <div className="mb-4 space-y-1.5">
        {order.items.map((i) => (
          <div key={i.id} className="flex items-center justify-between gap-2 rounded-lg bg-zinc-100 px-3 py-2 dark:bg-white/[0.03]">
            <p className="text-sm text-zinc-800 dark:text-zinc-200">
              <span className="mr-2 inline-flex h-5 min-w-6 items-center justify-center rounded-md bg-gold/15 px-1 text-xs font-bold text-gold-dark dark:text-gold-light">
                ×{i.quantity}
              </span>
              {i.name}
            </p>
            <p className="text-xs text-zinc-500">{formatCurrency(i.price * i.quantity)}</p>
          </div>
        ))}
      </div>

      {order.note && (
        <p className="mb-4 rounded-lg border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-200">
          Note: {order.note}
        </p>
      )}

      <div className="flex items-center justify-between border-t border-zinc-200 pt-3 dark:border-white/[0.06]">
        <p className="text-sm text-zinc-500">
          {order.items.reduce((s, i) => s + i.quantity, 0)} items
        </p>
        <div className="flex gap-2">{children}</div>
      </div>
    </motion.div>
  );
}

function ReceiptContent({ order }: { order: Order }) {
  const subtotal = order.items.reduce((s, i) => s + i.price * i.quantity, 0);
  const tax = Math.round(subtotal * 0.08 * 100) / 100;
  const total = subtotal + tax;
  return (
    <div className="rounded-2xl border border-white/10 bg-white p-5 text-zinc-900">
      <div className="border-b-2 border-dashed border-zinc-300 pb-4 text-center">
        <p className="font-serif text-lg font-bold tracking-wide">THE GOLDEN FORK</p>
        <p className="mt-1 text-xs text-zinc-500">
          Order #{order.orderNumber} · {new Date().toLocaleString()}
        </p>
        <p className="mt-1 text-xs text-zinc-500">{order.tableLabel}</p>
      </div>
      <div className="space-y-1.5 py-4 text-sm">
        {order.items.map((i) => (
          <div key={i.id} className="flex justify-between">
            <span>
              {i.name} <span className="text-zinc-400">× {i.quantity}</span>
            </span>
            <span>{formatCurrency(i.price * i.quantity)}</span>
          </div>
        ))}
      </div>
      <div className="space-y-1 border-t border-zinc-200 pt-3 text-sm">
        <div className="flex justify-between text-zinc-600">
          <span>Subtotal</span>
          <span>{formatCurrency(subtotal)}</span>
        </div>
        <div className="flex justify-between text-zinc-600">
          <span>Tax (8%)</span>
          <span>{formatCurrency(tax)}</span>
        </div>
        <div className="flex justify-between text-base font-bold">
          <span>Total</span>
          <span>{formatCurrency(total)}</span>
        </div>
      </div>
      <p className="mt-4 text-center text-xs text-zinc-400">
        Thank you — enjoy your meal!
      </p>
    </div>
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
    gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.45);
  } catch {
    /* audio unavailable */
  }
}
