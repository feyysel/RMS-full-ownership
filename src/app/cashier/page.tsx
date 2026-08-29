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
  RotateCcw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/stat-card";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input, Label } from "@/components/ui/input";
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
  discount: number;
  discountReason: string | null;
  paymentMethod: string | null;
  paidAt: string | null;
  voided: boolean;
  refunded: boolean;
  refundStatus: string | null;
  refundRequestedBy: string | null;
  createdAt: string;
  items: { id: string; name: string; quantity: number; price: number }[];
  table: { number: number; code: string } | null;
  waiter: { id: string; name: string } | null;
  cashier: { id: string; name: string } | null;
  receipt: {
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
    paymentMethod: string | null;
    paidAt: string | null;
  } | null;
};

const PAYMENT_LABEL: Record<string, string> = {
  CASH: "Cash",
  CARD: "Card (POS)",
  CARD_ONLINE: "Online card",
  OTHER: "Other",
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
  const [settleFor, setSettleFor] = React.useState<Order | null>(null);
  const [voiding, setVoiding] = React.useState<Order | null>(null);
  const [refunding, setRefunding] = React.useState<Order | null>(null);

  const [saving, setSaving] = React.useState(false);
  const [reason, setReason] = React.useState("");

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

  const refreshList = React.useCallback(() => {
    refreshNow();
  }, [refreshNow]);

  async function runAction(order: Order, action: string, body: Record<string, unknown>) {
    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...body }),
      });
      const d = await res.json();
      if (!res.ok) {
        toast.error(d.error ?? "Action failed");
        refreshList();
        return null;
      }
      return d.order as Order;
    } catch {
      toast.error("Network error");
      refreshList();
      return null;
    }
  }

  function openSettle(o: Order) {
    setSettleFor(o);
  }

  async function confirmSettle(e: React.FormEvent) {
    e.preventDefault();
    if (!settleFor) return;
    setSaving(true);
    const updated = await runAction(settleFor, "takeout", {});
    setSaving(false);
    setSettleFor(null);
    if (updated) {
      toast.success(`Order #${updated.orderNumber} checkout`);
      setReceiptFor({ ...updated, items: updated.items ?? settleFor.items, receipt: updated.receipt ?? null });
      refreshList();
    }
  }

  async function confirmVoid(e: React.FormEvent) {
    e.preventDefault();
    if (!voiding) return;
    setSaving(true);
    const updated = await runAction(voiding, "void", { reason: reason.trim() || null });
    setSaving(false);
    setVoiding(null);
    setReason("");
    if (updated) {
      toast.success(`Order #${updated.orderNumber} voided`);
      refreshList();
    }
  }

  async function confirmRefund(e: React.FormEvent) {
    e.preventDefault();
    if (!refunding) return;
    setSaving(true);
    const updated = await runAction(refunding, "refund", { reason: reason.trim() || null });
    setSaving(false);
    setRefunding(null);
    setReason("");
    if (updated) {
      toast.success(`Refund requested for Order #${updated.orderNumber} — awaiting manager approval`);
      refreshList();
    }
  }

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
              Order taken by a waiter — take it out to generate the receipt!
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-4">
        {data && taken.length === 0 && active.length === 0 && (
          <Card className="flex flex-col items-center justify-center py-20 text-center">
            <Banknote className="mb-4 h-12 w-12 text-zinc-700" />
            <p className="font-display text-xl font-semibold text-zinc-800 dark:text-zinc-200">No orders to process</p>
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
                <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-sky-700 dark:text-sky-300">
                  <Coins className="h-4 w-4" /> Take out · generate receipt &amp; send to kitchen
                </h2>
                <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                  {taken.map((o) => (
                    <OrderCard key={o.id} order={o} highlight={o.id === newOrderId}>
                      <div className="flex gap-2">
                        <Button onClick={() => openSettle(o)} className="flex-1">
                          <Printer className="h-4 w-4" /> Send to kitchen
                        </Button>
                        <Button variant="outline" onClick={() => setReceiptFor(o)}>
                          <ReceiptText className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" onClick={() => { setVoiding(o); setReason(""); }} title="Void order">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </OrderCard>
                  ))}
                </div>
              </section>
            )}

            {active.length > 0 && (
              <section>
                <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  <Package className="h-4 w-4 text-gold-dark dark:text-gold-light" /> Live orders
                </h2>
                <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                  {active.map((o) => (
                    <OrderCard key={o.id} order={o}>
                      <Button variant="outline" onClick={() => setReceiptFor(o)} className="flex-1">
                        <ReceiptText className="h-4 w-4" /> View receipt
                      </Button>
                      {["PAID", "SERVED", "COMPLETED"].includes(o.status) && !o.refunded && o.refundStatus !== "REQUESTED" && (
                        <Button
                          variant="outline"
                          onClick={() => { setRefunding(o); setReason(""); }}
                          title="Request refund"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      )}
                      {["PAID"].includes(o.status) && (
                        <Button
                          variant="outline"
                          onClick={() => { setVoiding(o); setReason(""); }}
                          title="Void order"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
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

      <Modal
        open={settleFor !== null}
        onClose={() => setSettleFor(null)}
        title={`Checkout · Order #${settleFor?.orderNumber}`}
        description={`${settleFor?.tableLabel} — generate the receipt and send to the kitchen.`}
      >
        <form onSubmit={confirmSettle} className="space-y-4">
          <div className="space-y-1.5">
            {settleFor?.items.map((i) => (
              <div key={i.id} className="flex items-center justify-between gap-2 rounded-lg bg-zinc-100 px-3 py-2 text-sm dark:bg-white/[0.03]">
                <span className="text-zinc-700 dark:text-zinc-200">
                  {i.name} <span className="text-zinc-400">× {i.quantity}</span>
                </span>
                <span className="text-zinc-500">{formatCurrency(i.price * i.quantity)}</span>
              </div>
            ))}
          </div>

          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Payment (discount, method &amp; cash) is collected by the waiter after the customer is served and finishes eating.
          </p>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => setSettleFor(null)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Processing…" : "Send to kitchen"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={voiding !== null}
        onClose={() => setVoiding(null)}
        title={`Void order? · #${voiding?.orderNumber}`}
        description="Cancels the order before payment. The full amount is written off."
      >
        <form onSubmit={confirmVoid} className="space-y-4">
          <div>
            <Label htmlFor="v-reason">Reason for voiding (required)</Label>
            <Input
              id="v-reason"
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. wrong order, customer left"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setVoiding(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" disabled={saving}>
              <Trash2 className="h-4 w-4" /> {saving ? "Voiding…" : "Void order"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={refunding !== null}
        onClose={() => setRefunding(null)}
        title={`Request refund? · #${refunding?.orderNumber}`}
        description={`Request to refund ${formatCurrency(refunding?.receipt?.total ?? refunding?.total ?? 0)} to the customer. A manager must approve it.`}
      >
        <form onSubmit={confirmRefund} className="space-y-4">
          <div>
            <Label htmlFor="r-reason">Reason for refund (required)</Label>
            <Input
              id="r-reason"
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. customer complaint, double charge"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setRefunding(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" disabled={saving}>
              <RotateCcw className="h-4 w-4" /> {saving ? "Requesting…" : "Request refund"}
            </Button>
          </div>
        </form>
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
        "rounded-2xl border bg-gradient-to-br from-zinc-100 to-zinc-100 p-5 shadow-soft backdrop-blur-sm dark:from-white/[0.06] dark:to-white/[0.01] " +
        (highlight ? "border-gold/50 ring-2 ring-gold/30" : "border-zinc-200 dark:border-white/10")
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
        <div className="flex items-center gap-1.5">
          {order.paymentMethod && <Badge tone="teal">{PAYMENT_LABEL[order.paymentMethod] ?? order.paymentMethod}</Badge>}
          {order.refunded ? (
            <Badge tone="rose">Refunded</Badge>
          ) : order.refundStatus === "REQUESTED" ? (
            <Badge tone="amber">Refund pending</Badge>
          ) : order.refundStatus === "DENIED" ? (
            <Badge tone="zinc">Refund denied</Badge>
          ) : order.voided ? (
            <Badge tone="rose">Voided</Badge>
          ) : null}
          <Badge tone={statusTone[order.status] ?? "amber"}>{order.status}</Badge>
        </div>
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
        <div className="text-sm">
          {order.discount > 0 && (
            <p className="text-xs text-zinc-500">Discount −{formatCurrency(order.discount)}</p>
          )}
          <p className="flex items-center gap-1 font-semibold text-gold-dark dark:text-gold-light">
            <Check className="h-4 w-4" />
            {formatCurrency(order.total)}
          </p>
        </div>
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
        {order.discount > 0 && (
          <div className="flex justify-between text-rose-600">
            <span>Discount{order.discountReason ? ` (${order.discountReason})` : ""}</span>
            <span>−{formatCurrency(order.discount)}</span>
          </div>
        )}
        <div className="flex justify-between text-zinc-600">
          <span>Tax (8%)</span>
          <span>{formatCurrency(tax)}</span>
        </div>
        <div className="flex justify-between text-base font-bold">
          <span>Total</span>
          <span>{formatCurrency(total)}</span>
        </div>
        {order.paymentMethod && (
          <div className="flex justify-between pt-1 text-xs text-zinc-500">
            <span>Paid via</span>
            <span>{PAYMENT_LABEL[order.paymentMethod] ?? order.paymentMethod}</span>
          </div>
        )}
      </div>
      <p className="mt-4 text-center text-xs text-zinc-400">Thank you — enjoy your meal!</p>
    </div>
  );
}

function printReceipt(o: Order) {
  const subtotal = o.receipt?.subtotal ?? o.items.reduce((s, i) => s + i.price * i.quantity, 0);
  const discount = o.receipt?.discount ?? o.discount ?? 0;
  const tax = o.receipt?.tax ?? Math.round((subtotal - discount) * 0.08 * 100) / 100;
  const total = o.receipt?.total ?? subtotal - discount + tax;
  const paymentMethod = o.receipt?.paymentMethod ?? o.paymentMethod ?? null;
  const paidAt = o.receipt?.paidAt ?? o.paidAt;

  const itemsHtml = o.items
    .map(
      (i) => `
      <tr>
        <td>${escapeHtml(i.name)} × ${i.quantity}</td>
        <td class="r">${formatCurrency(i.price * i.quantity)}</td>
      </tr>`
    )
    .join("");

  const discountRow =
    discount > 0
      ? `<tr><td>Discount${o.discountReason ? ` (${escapeHtml(o.discountReason)})` : ""}</td><td class="r">-${formatCurrency(discount)}</td></tr>`
      : "";

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
    <p class="dim">${escapeHtml(o.tableLabel)} · ${new Date(paidAt ?? o.createdAt).toLocaleString()}</p>
  </div>
  <table>
    ${itemsHtml}
  </table>
  <div class="dash"></div>
  <table>
    <tr><td>Subtotal</td><td class="r">${formatCurrency(subtotal)}</td></tr>
    ${discountRow}
    <tr><td>Tax (8%)</td><td class="r">${formatCurrency(tax)}</td></tr>
    <tr class="total-row"><td>Total</td><td class="r">${formatCurrency(total)}</td></tr>
    ${paymentMethod ? `<tr><td>Paid via</td><td class="r">${escapeHtml(PAYMENT_LABEL[paymentMethod] ?? paymentMethod)}</td></tr>` : ""}
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
