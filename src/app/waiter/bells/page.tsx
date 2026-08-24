"use client";

import * as React from "react";
import { motion } from "motion/react";
import { BellRing, Check, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/stat-card";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { timeAgo } from "@/lib/utils";
import { useRealtime } from "@/components/realtime/use-realtime";
import { useDebouncedCallback } from "@/lib/use-debounced";

type BellTable = {
  id: string;
  number: number;
  status: string;
  waiter: { id: string; name: string } | null;
  bellCalls: { id: string; createdAt: string }[];
};

export default function WaiterBells() {
  const [meId, setMeId] = React.useState<string | null>(null);
  const [restaurantId, setRestaurantId] = React.useState<string | null>(null);
  const [tables, setTables] = React.useState<BellTable[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [responding, setResponding] = React.useState<string | null>(null);

  async function refreshNow() {
    const res = await fetch("/api/tables");
    if (res.ok) {
      const d = await res.json();
      setTables(d.tables ?? []);
    }
    setLoading(false);
  }
  const refresh = useDebouncedCallback(refreshNow, 250);

  useRealtime(
    restaurantId ? [{ scope: "restaurant", id: restaurantId }] : [],
    (evt) => {
      if (evt.type === "BELL") {
        playChime();
        refresh();
      }
      if (evt.type !== "heartbeat") refresh();
    }
  );

  React.useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => {
        setMeId(d.user?.id ?? null);
        setRestaurantId(d.user?.restaurantId ?? null);
      })
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function respond(bellId: string) {
    setResponding(bellId);
    try {
      const res = await fetch(`/api/bell/${bellId}`, { method: "PATCH" });
      if (!res.ok) throw new Error("Failed");
      toast.success("Bell answered");
      refresh();
    } catch {
      toast.error("Could not respond to bell");
    } finally {
      setResponding(null);
    }
  }

  const ringing = tables
    .flatMap((t) =>
      t.bellCalls.map((b) => ({ ...b, table: t }))
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const mine = ringing.filter((r) => r.table.waiter?.id === meId);
  const others = ringing.filter((r) => r.table.waiter?.id !== meId);

  return (
    <div>
      <PageHeader
        title="Service Bells"
        description="A customer is calling — every ring is urgent."
      />

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : ringing.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 ring-1 ring-emerald-500/25">
            <CheckCircle2 className="h-7 w-7 text-emerald-300" />
          </div>
          <p className="font-display text-xl font-semibold text-zinc-200">
            All tables are being served
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            New bells will appear here the moment a customer rings.
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          {mine.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-rose-300">
                <BellRing className="h-4 w-4" /> Your tables
              </h2>
              <div className="grid gap-3 lg:grid-cols-2">
                {mine.map((b) => (
                  <RingingCard
                    key={b.id}
                    tableNumber={b.table.number}
                    createdAt={b.createdAt}
                    responding={responding === b.id}
                    onRespond={() => respond(b.id)}
                  />
                ))}
              </div>
            </section>
          )}

          {others.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500">
                Other tables
              </h2>
              <div className="grid gap-3 lg:grid-cols-2">
                {others.map((b) => (
                  <RingingCard
                    key={b.id}
                    tableNumber={b.table.number}
                    createdAt={b.createdAt}
                    responding={responding === b.id}
                    onRespond={() => respond(b.id)}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function RingingCard({
  tableNumber,
  createdAt,
  responding,
  onRespond,
}: {
  tableNumber: number;
  createdAt: string;
  responding: boolean;
  onRespond: () => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
    >
      <Card className="relative overflow-hidden border-rose-400/30 ring-1 ring-rose-400/20">
        <span className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-rose-500 to-amber-400" />
        <div className="flex items-center gap-4">
          <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-300 ring-1 ring-rose-400/30">
            <BellRing className="h-6 w-6 animate-pulse-soft" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg font-semibold text-zinc-50">
              Table {tableNumber}
            </p>
            <p className="mt-0.5 flex items-center gap-2 text-xs text-zinc-500">
              {timeAgo(createdAt)}
              <Badge tone="rose">Ringing</Badge>
            </p>
          </div>
          <Button variant="success" onClick={onRespond} disabled={responding}>
            {responding ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            Answer
          </Button>
        </div>
      </Card>
    </motion.div>
  );
}

let audioCtx: AudioContext | null = null;
function playChime() {
  try {
    audioCtx = audioCtx ?? new AudioContext();
    const ctx = audioCtx;
    const notes = [880, 660];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.18;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.4);
    });
  } catch {
    /* audio unavailable */
  }
}
