"use client";

import * as React from "react";
import { motion, AnimatePresence } from "motion/react";
import { Printer, ReceiptText, Search } from "lucide-react";
import { PageHeader } from "@/components/ui/stat-card";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatTime, formatDate } from "@/lib/utils";
import { useRealtime } from "@/components/realtime/use-realtime";
import { useDebouncedCallback } from "@/lib/use-debounced";

type Receipt = {
  id: string;
  orderId: string;
  orderNumber: number;
  tableLabel: string;
  type: "DINE_IN" | "TAKEAWAY";
  items: { name: string; price: number; quantity: number }[];
  subtotal: number;
  tax: number;
  total: number;
  kitchenName: string;
  waiterName: string;
  generatedAt: string;
};

export default function KitchenReceipts() {
  const [data, setData] = React.useState<Receipt[] | null>(null);
  const [restaurantId, setRestaurantId] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const [selected, setSelected] = React.useState<Receipt | null>(null);

  async function refreshNow() {
    const res = await fetch("/api/kitchen/receipts");
    if (res.ok) setData((await res.json()).receipts ?? []);
  }
  const refresh = useDebouncedCallback(refreshNow, 250);

  useRealtime(
    restaurantId ? [{ scope: "restaurant", id: restaurantId }] : [],
    () => refresh()
  );

  React.useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => setRestaurantId(d.user?.restaurantId ?? null))
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered =
    data?.filter((r) => {
      const q = query.toLowerCase();
      return (
        String(r.orderNumber).includes(q) ||
        r.tableLabel.toLowerCase().includes(q) ||
        r.kitchenName.toLowerCase().includes(q)
      );
    }) ?? [];

  return (
    <div>
      <PageHeader
        title="Receipts"
        description="Every dish you've released — neatly itemised and printable."
      />

      <div className="relative mb-5">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by order number, table…"
          className="pl-10"
        />
      </div>

      {!data ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-20 text-center">
          <ReceiptText className="mb-4 h-12 w-12 text-zinc-700" />
          <p className="font-display text-xl font-semibold text-zinc-200">
            No receipts yet
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            Receipts are generated the moment an order is marked done.
          </p>
        </Card>
      ) : (
        <div className="space-y-2.5">
          <AnimatePresence>
            {filtered.map((r) => (
              <motion.button
                key={r.id}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                onClick={() => setSelected(r)}
                className="flex w-full items-center gap-4 rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.06] to-white/[0.01] p-4 text-left shadow-soft backdrop-blur-sm transition-all hover:border-gold/30"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gold/10 ring-1 ring-gold/25">
                  <ReceiptText className="h-5 w-5 text-gold-light" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-display text-base font-semibold text-zinc-50">
                      Order #{r.orderNumber}
                    </p>
                    <Badge tone={r.type === "TAKEAWAY" ? "sky" : "amber"}>
                      {r.type === "TAKEAWAY" ? "Takeaway" : "Dine-in"}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {r.tableLabel} · {formatDate(r.generatedAt)} · {formatTime(r.generatedAt)} · by {r.kitchenName}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-display text-lg font-semibold text-gold-light">
                    {formatCurrency(r.total)}
                  </p>
                  <p className="text-xs text-zinc-500">{r.items.length} item(s)</p>
                </div>
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
      )}

      <Modal
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={`Receipt · Order #${selected?.orderNumber}`}
        description={selected ? `${selected.tableLabel} · ${formatDate(selected.generatedAt)}` : ""}
      >
        {selected && (
          <div>
            <div className="rounded-2xl border border-white/10 bg-white p-5 text-zinc-900">
              <div className="border-b-2 border-dashed border-zinc-300 pb-4 text-center">
                <p className="font-serif text-lg font-bold tracking-wide">THE GOLDEN FORK</p>
                <p className="mt-1 text-xs text-zinc-500">
                  Receipt #{selected.orderNumber} ·{" "}
                  {new Date(selected.generatedAt).toLocaleString()}
                </p>
                <p className="mt-1 text-xs text-zinc-500">{selected.tableLabel}</p>
              </div>
              <div className="space-y-1.5 py-4 text-sm">
                {selected.items.map((i, idx) => (
                  <div key={idx} className="flex justify-between">
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
                  <span>{formatCurrency(selected.subtotal)}</span>
                </div>
                <div className="flex justify-between text-zinc-600">
                  <span>Tax (8%)</span>
                  <span>{formatCurrency(selected.tax)}</span>
                </div>
                <div className="flex justify-between text-base font-bold">
                  <span>Total</span>
                  <span>{formatCurrency(selected.total)}</span>
                </div>
              </div>
              <div className="mt-4 border-t border-zinc-200 pt-3 text-xs text-zinc-500">
                <p className="flex justify-between">
                  <span>Prepared by</span>
                  <span>{selected.kitchenName}</span>
                </p>
                <p className="mt-1 flex justify-between">
                  <span>For waiter</span>
                  <span>{selected.waiterName}</span>
                </p>
              </div>
              <p className="mt-4 text-center text-xs text-zinc-400">
                Thank you — enjoy your meal!
              </p>
            </div>
            <div className="mt-4 flex justify-end">
              <Button onClick={() => printReceipt(selected)}>
                <Printer className="h-4 w-4" /> Print receipt
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function printReceipt(r: Receipt) {
  const itemsHtml = r.items
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
<title>Receipt #${r.orderNumber}</title>
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
    <p class="dim">Receipt #${r.orderNumber}</p>
    <p class="dim">${escapeHtml(r.tableLabel)} · ${new Date(r.generatedAt).toLocaleString()}</p>
  </div>
  <table>
    ${itemsHtml}
  </table>
  <div class="dash"></div>
  <table>
    <tr><td>Subtotal</td><td class="r">${formatCurrency(r.subtotal)}</td></tr>
    <tr><td>Tax (8%)</td><td class="r">${formatCurrency(r.tax)}</td></tr>
    <tr class="total-row"><td>Total</td><td class="r">${formatCurrency(r.total)}</td></tr>
    <tr><td class="dim">Prepared by</td><td class="r dim">${escapeHtml(r.kitchenName)}</td></tr>
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
