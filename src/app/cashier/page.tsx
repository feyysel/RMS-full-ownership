"use client";

import * as React from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Banknote,
  Bell,
  Check,
  Coins,
  Package,
  Printer,
  ReceiptText,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/stat-card";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatTime } from "@/lib/utils";
import { useRealtime } from "@/components/realtime/use-realtime";
import { useDebouncedCallback } from "@/lib/use-debounced";

type Order = {
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
  receipt: { subtotal: number; tax: number; total: number } | null;
};

const statusTone: Record<string, "amber" | "sky" | "gold" | "violet" | "teal" | "emerald" | "rose"> = {
  PENDING: "amber",
  TAKEN: "sky",
  PAID: "gold",
  ACCEPTED: "violet",
  COOKING: "teal",
  READY: "emerald",
  CANCELLED: "rose",
};

export default function CashierDashboard() {
  const [data, setData] = React.useState<{ orders: Order[] } | null>(null);
  const [restaurantId, setRestaurantId] = React.useState<string | null>(null);
  const [receiptFor, setReceiptFor] = React.useState<Order | null>(null);
  const [newOrderId, setNewOrderId] = React.useState<string | null>(null);

  const refreshNow = React.useCallback(async () => {
    const res = await fetch("/api/cashier/orders");
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshNow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const act = React.useCallback(
    async (orderId: string, action: "takeout", label: string) => {
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          orders: prev.orders.map((o) =>
            o.id === orderId ? { ...o, status: "PAID" } : o
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
        toast.success(label);
        setReceiptFor({ ...d.order, items: d.order.items ?? [], receipt: d.order.receipt ?? null });
      } catch {
        toast.error("Network error");
        refresh();
      }
    },
    [refresh]
  );

  const orders = data?.orders ?? [];
  const taken = orders.filter((o) => o.status === "TAKEN" || o.status === "PENDING");
  const active = orders.filter((o) => !["TAKEN", "PENDING", "CANCELLED"].includes(o.status));
  const paid = active.filter((o) => o.status === "PAID");

  return (
    <div>
      <PageHeader
        title="Cashier"
        description="Take orders, print receipts, and push them to the kitchen — all in real time."
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "To take out", value: taken.length, tone: "bg-sky-400", pulse: taken.length > 0 },
          { label: "Paid", value: paid.length, tone: "bg-gold", pulse: paid.length > 0 },
          { label: "In kitchen", value: active.filter((o) => ["ACCEPTED", "COOKING"].includes(o.status)).length, tone: "bg-violet-400", pulse: false },
          { label: "Ready / served", value: active.filter((o) => ["READY", "SERVED"].includes(o.status)).length, tone: "bg-emerald-400", pulse: false },
        ].map((s) => (
          <Card key={s.label} className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs uppercase tracking-wider text-zinc-500">{s.label}</p>
              {data ? (
                <p className="mt-1 font-display text-3xl font-semibold text-zinc-50">{s.value}</p>
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
            <Bell className="h-5 w-5 animate-pulse-soft text-gold-light" />
            <p className="flex-1 text-sm font-medium text-gold-light">
              Order taken by a waiter — take it out to generate the receipt!
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-4">
        {data && taken.length === 0 && active.length === 0 && (
          <Card className="flex flex-col items-center justify-center py-20 text-center">
            <Banknote className="mb-4 h-12 w-12 text-zinc-700" />
            <p className="font-display text-xl font-semibold text-zinc-200">No orders to process</p>
            <p className="mt-1 text-sm text-zinc-500">
              Orders take by waiters will appear here for you to take out.
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
            {taken.length > 0 && (
              <section>
                <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-sky-300">
                  <Coins className="h-4 w-4" /> Take out · generate receipt &amp; send to kitchen
                </h2>
                <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                  {taken.map((o) => (
                    <OrderCard key={o.id} order={o} highlight={o.id === newOrderId}>
                      <div className="flex gap-2">
                        <Button
                          onClick={() =>
                            act(o.id, "takeout", `Order #${o.orderNumber} taken out — sent to kitchen`)
                          }
                          className="flex-1"
                        >
                          <Printer className="h-4 w-4" /> Take out &amp; print
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setReceiptFor(o)}
                        >
                          <ReceiptText className="h-4 w-4" />
                        </Button>
                      </div>
                    </OrderCard>
                  ))}
                </div>
              </section>
            )}

            {active.length > 0 && (
              <section>
                <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-zinc-400">
                  <Package className="h-4 w-4 text-gold-light" /> Live orders
                </h2>
                <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                  {active.map((o) => (
                    <OrderCard key={o.id} order={o}>
                      <Button variant="outline" onClick={() => setReceiptFor(o)} className="flex-1">
                        <ReceiptText className="h-4 w-4" /> View receipt
                      </Button>
                    </OrderCard>
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
        {receiptFor && (
          <div>
            <ReceiptContent order={receiptFor} />
            <div className="mt-4 flex justify-end">
              <Button onClick={() => printReceipt(receiptFor)}>
                <Printer className="h-4 w-4" /> Print receipt
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function OrderCard({
  order,
  children,
  highlight,
}: {
  order: Order;
  children: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={
        "rounded-2xl border bg-gradient-to-br from-white/[0.06] to-white/[0.01] p-5 shadow-soft backdrop-blur-sm " +
        (highlight ? "border-gold/50 ring-2 ring-gold/30" : "border-white/10")
      }
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold/10 font-display text-sm font-bold text-gold-light ring-1 ring-gold/25">
            #{order.orderNumber}
          </div>
          <div>
            <p className="font-medium text-zinc-100">{order.tableLabel}</p>
            <p className="text-xs text-zinc-500">
              {formatTime(order.createdAt)} · {order.waiter?.name ?? "Customer"}
            </p>
          </div>
        </div>
        <Badge tone={statusTone[order.status] ?? "amber"}>{order.status}</Badge>
      </div>

      <div className="mb-4 space-y-1.5">
        {order.items.map((i) => (
          <div key={i.id} className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.03] px-3 py-2">
            <p className="text-sm text-zinc-200">
              <span className="mr-2 inline-flex h-5 min-w-6 items-center justify-center rounded-md bg-gold/15 px-1 text-xs font-bold text-gold-light">
                ×{i.quantity}
              </span>
              {i.name}
            </p>
            <p className="text-xs text-zinc-500">{formatCurrency(i.price * i.quantity)}</p>
          </div>
        ))}
      </div>

      {order.note && (
        <p className="mb-4 rounded-lg border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-xs text-amber-200">
          Note: {order.note}
        </p>
      )}

      <div className="flex items-center justify-between border-t border-white/[0.06] pt-3">
        <p className="flex items-center gap-1 text-sm font-semibold text-gold-light">
          <Check className="h-4 w-4" />
          {formatCurrency(order.total)}
        </p>
        <div className="flex gap-2">{children}</div>
      </div>
    </motion.div>
  );
}

function ReceiptContent({ order }: { order: Order }) {
  const subtotal = order.receipt?.subtotal ?? order.items.reduce((s, i) => s + i.price * i.quantity, 0);
  const tax = order.receipt?.tax ?? Math.round(subtotal * 0.08 * 100) / 100;
  const total = order.receipt?.total ?? subtotal + tax;
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
      <p className="mt-4 text-center text-xs text-zinc-400">Thank you — enjoy your meal!</p>
    </div>
  );
}

function printReceipt(o: Order) {
  const subtotal = o.receipt?.subtotal ?? o.items.reduce((s, i) => s + i.price * i.quantity, 0);
  const tax = o.receipt?.tax ?? Math.round(subtotal * 0.08 * 100) / 100;
  const total = o.receipt?.total ?? subtotal + tax;

  const itemsHtml = o.items
    .map(
      (i) => `
      <tr>
        <td>${escapeHtml(i.name)} × ${i.quantity}</td>
        <td class="r">${formatCurrency(i.price * i.quantity)}</td>
      </tr>`
    )
    .join("");

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Receipt #${o.orderNumber}</title>
<style>
  body { font-family: Georgia, 'Times New Roman', serif; color: #111; max-width: 320px; margin: 24px auto; }
  .center { text-align: center; }
  h1 { font-size: 20px; letter-spacing: 1px; margin: 0 0 4px; }
  .dim { color: #666; font-size: 11px; margin: 2px 0; }
  table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
  td { padding: 3px 0; vertical-align: top; }
  td.r { text-align: right; }
  .dash { border-top: 1px dashed #999; margin: 8px 0; }
  .total-row td { padding-top: 8px; font-weight: bold; }
  .thanks { text-align: center; font-size: 11px; color: #666; margin-top: 16px; }
</style>
</head>
<body>
  <div class="center">
    <h1>THE GOLDEN FORK</h1>
    <p class="dim">Receipt #${o.orderNumber}</p>
    <p class="dim">${escapeHtml(o.tableLabel)} · ${new Date(o.createdAt).toLocaleString()}</p>
  </div>
  <table>
    ${itemsHtml}
  </table>
  <div class="dash"></div>
  <table>
    <tr><td>Subtotal</td><td class="r">${formatCurrency(subtotal)}</td></tr>
    <tr><td>Tax (8%)</td><td class="r">${formatCurrency(tax)}</td></tr>
    <tr class="total-row"><td>Total</td><td class="r">${formatCurrency(total)}</td></tr>
  </table>
  <p class="thanks">Thank you — enjoy your meal!</p>
</body>
</html>`;

  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 300);
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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
