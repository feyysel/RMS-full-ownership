"use client";

import * as React from "react";
import { Banknote, CheckCircle2, RotateCcw, ScrollText, ShieldX, XCircle } from "lucide-react";
import { PageHeader } from "@/components/ui/stat-card";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDate, formatTime, timeAgo } from "@/lib/utils";
import { useRealtime } from "@/components/realtime/use-realtime";
import { useDebouncedCallback } from "@/lib/use-debounced";

type AuditEvent = {
  id: string;
  type: string;
  label: string;
  createdAt: string;
  actor: string | null;
  actorId: string | null;
  orderNumber: number | null;
  orderId: string | null;
  tableLabel: string | null;
  amount: number | null;
  paymentMethod: string | null;
  reason: string | null;
};

const EVENT_TONE: Record<string, "emerald" | "rose" | "amber" | "sky" | "zinc"> = {
  ORDER_PAYMENT: "emerald",
  ORDER_VOIDED: "rose",
  ORDER_REFUND_REQUESTED: "amber",
  ORDER_REFUND_APPROVED: "rose",
  ORDER_REFUND_DENIED: "sky",
};

const EVENT_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  ORDER_PAYMENT: Banknote,
  ORDER_VOIDED: ShieldX,
  ORDER_REFUND_REQUESTED: RotateCcw,
  ORDER_REFUND_APPROVED: CheckCircle2,
  ORDER_REFUND_DENIED: XCircle,
};

const PAYMENT_LABEL: Record<string, string> = {
  CASH: "Cash",
  CBE: "CBE",
  TELEBIRR: "TeleBirr",
  ABYSSINIA: "Abyssinia",
  POS: "POS",
};

export default function ManagerAudit() {
  const [events, setEvents] = React.useState<AuditEvent[] | null>(null);
  const [restaurantId, setRestaurantId] = React.useState<string | null>(null);
  const [days, setDays] = React.useState("30");

  async function refreshNow() {
    const res = await fetch(`/api/manager/audit?days=${days}`);
    if (res.ok) setEvents((await res.json()).events ?? []);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  return (
    <div>
      <PageHeader
        title="Audit Trail"
        description="A clear, complete history of payments, voids and refunds — who did what and when."
      />

      <div className="mb-5 flex items-center gap-3">
        <ScrollText className="h-4 w-4 text-gold-dark dark:text-gold-light" />
        <Select value={days} onChange={(e) => setDays(e.target.value)} className="w-44">
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
        </Select>
      </div>

      {!events ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-20 text-center">
          <ScrollText className="mb-4 h-12 w-12 text-zinc-700" />
          <p className="font-display text-xl font-semibold text-zinc-800 dark:text-zinc-200">No activity yet</p>
          <p className="mt-1 text-sm text-zinc-500">
            Payments, voids and refund activity will show up here.
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {events.map((e) => {
            const Icon = EVENT_ICON[e.type] ?? ScrollText;
            const tone = EVENT_TONE[e.type] ?? "zinc";
            return (
              <div
                key={e.id}
                className="flex items-start gap-4 rounded-2xl border border-zinc-200 bg-gradient-to-br from-zinc-100 to-zinc-100 p-4 shadow-soft backdrop-blur-sm dark:border-white/[0.08] dark:from-white/[0.06] dark:to-white/[0.01]"
              >
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ${tone === "rose" ? "bg-rose-500/10 ring-rose-500/20" : tone === "amber" ? "bg-amber-500/10 ring-amber-500/20" : tone === "sky" ? "bg-sky-500/10 ring-sky-500/20" : "bg-emerald-500/10 ring-emerald-500/20"}`}>
                  <Icon className={`h-5 w-5 ${tone === "rose" ? "text-rose-500" : tone === "amber" ? "text-amber-500" : tone === "sky" ? "text-sky-500" : "text-emerald-500"}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={tone}>{e.label}</Badge>
                    {e.orderNumber != null && (
                      <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Order #{e.orderNumber}</span>
                    )}
                    {e.amount != null && (
                      <span className="font-display text-base font-semibold text-gold-dark dark:text-gold-light">
                        {formatCurrency(e.amount)}
                      </span>
                    )}
                    {e.paymentMethod && (
                      <Badge tone="teal">{PAYMENT_LABEL[e.paymentMethod] ?? e.paymentMethod}</Badge>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">
                    <span className="font-medium text-zinc-700 dark:text-zinc-200">{e.actor ?? "Unknown"}</span>
                    {" · "}
                    {e.tableLabel ? `${e.tableLabel} · ` : ""}
                    {timeAgo(e.createdAt)} · {formatDate(e.createdAt)} {formatTime(e.createdAt)}
                  </p>
                  {e.reason && (
                    <p className="mt-1.5 rounded-lg bg-white/50 px-2.5 py-1.5 text-xs text-zinc-600 dark:bg-white/[0.03] dark:text-zinc-300">
                      <span className="font-semibold text-zinc-700 dark:text-zinc-200">Reason:</span> {e.reason}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
