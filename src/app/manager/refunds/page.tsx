"use client";

import * as React from "react";
import { CalendarClock, Check, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/stat-card";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input, Label } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatTime, formatDate } from "@/lib/utils";
import { useRealtime } from "@/components/realtime/use-realtime";
import { useDebouncedCallback } from "@/lib/use-debounced";

type Refund = {
  id: string;
  orderNumber: number;
  status: string;
  tableLabel: string;
  total: number;
  paymentMethod: string | null;
  paidAt: string | null;
  reason: string | null;
  requestedAt: string | null;
  requestedBy: string | null;
  requestedById: string | null;
  waiterName: string | null;
  items: { name: string; quantity: number; price: number }[];
};

const PAYMENT_LABEL: Record<string, string> = {
  CASH: "Cash",
  CARD: "Card (POS)",
  CARD_ONLINE: "Online card",
  OTHER: "Other",
};

export default function ManagerRefunds() {
  const [refunds, setRefunds] = React.useState<Refund[] | null>(null);
  const [restaurantId, setRestaurantId] = React.useState<string | null>(null);
  const [acting, setActing] = React.useState<Refund | null>(null);
  const [decision, setDecision] = React.useState<"approve" | "decline" | null>(null);
  const [declineReason, setDeclineReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function refreshNow() {
    const res = await fetch("/api/manager/refunds");
    if (res.ok) setRefunds((await res.json()).refunds ?? []);
  }
  const refresh = useDebouncedCallback(refreshNow, 300);

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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshNow();
  }, []);

  function ask(r: Refund, decision: "approve" | "decline") {
    setActing(r);
    setDecision(decision);
    setDeclineReason("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!acting || !decision) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/orders/${acting.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          decision === "approve"
            ? { action: "refund-approve" }
            : { action: "refund-decline", reason: declineReason.trim() || null }
        ),
      });
      const d = await res.json();
      if (!res.ok) {
        toast.error(d.error ?? "Could not process refund");
        return;
      }
      toast.success(
        decision === "approve"
          ? `Refund approved for Order #${acting.orderNumber}`
          : `Refund declined for Order #${acting.orderNumber}`
      );
      setActing(null);
      refresh();
    } catch {
      toast.error("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Refund Approvals"
        description="Review refund requests from cashiers and approve or decline them."
      />

      {!refunds ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : refunds.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-20 text-center">
          <RotateCcw className="mb-4 h-12 w-12 text-zinc-700" />
          <p className="font-display text-xl font-semibold text-zinc-800 dark:text-zinc-200">No pending refunds</p>
          <p className="mt-1 text-sm text-zinc-500">
            Refund requests from cashiers will appear here for your approval.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {refunds.map((r) => (
            <Card key={r.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-display text-base font-semibold text-zinc-900 dark:text-zinc-50">
                      Order #{r.orderNumber}
                    </p>
                    <Badge tone="amber">Pending approval</Badge>
                    {r.paymentMethod && (
                      <Badge tone="teal">{PAYMENT_LABEL[r.paymentMethod] ?? r.paymentMethod}</Badge>
                    )}
                  </div>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-zinc-500">
                    <CalendarClock className="h-3.5 w-3.5" />
                    {r.tableLabel} · requested {r.requestedAt ? `${formatDate(r.requestedAt)} ${formatTime(r.requestedAt)}` : "—"} by {r.requestedBy ?? "Cashier"}
                    {r.waiterName ? ` · waiter ${r.waiterName}` : ""}
                  </p>
                </div>
                <p className="font-display text-xl font-semibold text-gold-dark dark:text-gold-light">
                  {formatCurrency(r.total)}
                </p>
              </div>

              <div className="mt-3 rounded-xl border border-zinc-200 p-3 dark:border-white/10">
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Refund reason</p>
                <p className="mt-1 text-sm text-zinc-800 dark:text-zinc-200">{r.reason || "No reason provided"}</p>
              </div>

              {r.items.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {r.items.map((i) => (
                    <span
                      key={`${i.name}-${i.quantity}`}
                      className="rounded-full border border-zinc-200 bg-zinc-100 px-2.5 py-1 text-xs text-zinc-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-zinc-300"
                    >
                      {i.quantity}× {i.name}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <Button variant="outline" onClick={() => ask(r, "decline")}>
                  <X className="h-4 w-4" /> Decline
                </Button>
                <Button variant="danger" onClick={() => ask(r, "approve")}>
                  <Check className="h-4 w-4" /> Approve &amp; refund
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={acting !== null}
        onClose={() => setActing(null)}
        title={decision === "approve" ? "Approve refund?" : "Decline refund?"}
        description={
          acting
            ? decision === "approve"
              ? `Refund ${formatCurrency(acting.total)} for Order #${acting.orderNumber}. This cancels the order and records the refund.`
              : `Decline the refund request for Order #${acting.orderNumber}.`
            : ""
        }
      >
        <form onSubmit={submit} className="space-y-4">
          {decision === "decline" && (
            <div>
              <Label htmlFor="decline-reason">Reason for declining (required)</Label>
              <Input
                id="decline-reason"
                required
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                placeholder="e.g. not eligible, already resolved"
              />
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setActing(null)}>
              Cancel
            </Button>
            <Button type="submit" variant={decision === "approve" ? "danger" : "default"} disabled={busy}>
              {busy ? "Processing…" : decision === "approve" ? "Approve refund" : "Decline refund"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
