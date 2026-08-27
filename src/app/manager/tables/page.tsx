"use client";

import * as React from "react";
import {
  Plus,
  Trash2,
  QrCode as QrIcon,
  Grid3X3,
  ExternalLink,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { QrCode } from "@/components/ui/qr-code";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils";
import { useFetch } from "@/lib/use-fetch";
import { useRealtime } from "@/components/realtime/use-realtime";
import { useDebouncedCallback } from "@/lib/use-debounced";

type TableRow = {
  id: string;
  number: number;
  code: string;
  status: string;
  waiter: { id: string; name: string } | null;
  bellCalls: { id: string }[];
  orders: { id: string; orderNumber: number; status: string; total: number; items: { id: string }[] }[];
};

type Employee = { id: string; name: string; role: string };

type TablesData = { tables: TableRow[] };
type UsersData = { users: Employee[] };

export default function ManagerTables() {
  const tables = useFetch<TablesData>("/api/tables");
  const employees = useFetch<UsersData>("/api/users");
  const [restaurantId, setRestaurantId] = React.useState<string | null>(null);
  const refresh = useDebouncedCallback(() => {
    tables.refresh();
    employees.refresh();
  }, 500);

  useRealtime(restaurantId ? [{ scope: "restaurant", id: restaurantId }] : [], () => refresh());

  React.useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => setRestaurantId(d.user?.restaurantId ?? null))
      .catch(() => {});
  }, []);

  const [modal, setModal] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [number, setNumber] = React.useState("");
  const [waiterId, setWaiterId] = React.useState("");
  const [qrFor, setQrFor] = React.useState<TableRow | null>(null);
  const [deleting, setDeleting] = React.useState<TableRow | null>(null);

  const waiters = employees.data?.users.filter((u) => u.role === "WAITER") ?? [];

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ number: Number(number), waiterId: waiterId || undefined }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Failed");
      toast.success(`Table ${number} created — scan the QR to open it`);
      setModal(false);
      setNumber("");
      setWaiterId("");
      tables.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function assignWaiter(t: TableRow, newWaiterId: string) {
    const res = await fetch(`/api/tables/${t.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ waiterId: newWaiterId }),
    });
    if (res.ok) {
      toast.success(`Waiter assigned to Table ${t.number}`);
      tables.refresh();
    } else {
      toast.error("Failed to assign");
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    try {
      const res = await fetch(`/api/tables/${deleting.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      toast.success("Table removed");
      setDeleting(null);
      tables.refresh();
    } catch {
      toast.error("Failed to delete");
    }
  }

  const tableUrl = (code: string) =>
    typeof window !== "undefined" ? `${window.location.origin}/table/${code}` : "";

  return (
    <div>
      <PageHeader
        title="Tables"
        description="Create tables, assign waiters and generate customer QR menus."
        action={
          <Button onClick={() => setModal(true)}>
            <Plus className="h-4 w-4" /> Add table
          </Button>
        }
      />

      {tables.loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {(tables.data?.tables ?? []).map((t) => {
            const hasBell = t.bellCalls.length > 0;
            const activeOrder = t.orders[0];
            return (
              <Card key={t.id} className="relative overflow-hidden">
                <div
                  className={cn(
                    "absolute inset-x-0 top-0 h-1",
                    hasBell
                      ? "bg-gradient-to-r from-rose-500 to-amber-400"
                      : t.status === "occupied"
                        ? "bg-gold"
                        : "bg-emerald-500/50"
                  )}
                />
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.05] font-display text-xl font-semibold text-zinc-100 ring-1 ring-white/10">
                      {t.number}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-zinc-100">
                        Table {t.number}
                      </p>
                      <Badge
                        tone={hasBell ? "rose" : t.status === "occupied" ? "amber" : "emerald"}
                        className="mt-1 capitalize"
                      >
                        {hasBell ? "Bell ringing" : t.status}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setQrFor(t)}
                      className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-white/10 hover:text-gold-light"
                      title="QR menu"
                    >
                      <QrIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setDeleting(t)}
                      className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-white/10 hover:text-rose-300"
                      title="Remove"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {activeOrder && (
                  <div className="mt-3 rounded-xl bg-white/[0.04] px-3 py-2.5">
                    <p className="text-xs text-zinc-400">
                      Order <span className="font-semibold text-gold-light">#{activeOrder.orderNumber}</span>
                    </p>
                    <div className="mt-1 flex items-center justify-between">
                      <Badge tone={orderTone(activeOrder.status)}>{activeOrder.status}</Badge>
                      <p className="text-sm font-semibold text-zinc-100">
                        {formatCurrency(activeOrder.total)}
                      </p>
                    </div>
                  </div>
                )}

                <div className="mt-4">
                  <Label className="mb-1.5">Assigned waiter</Label>
                  <Select
                    value={t.waiter?.id ?? ""}
                    onChange={(e) => assignWaiter(t, e.target.value)}
                  >
                    <option value="">Unassigned</option>
                    {waiters.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </Select>
                </div>
              </Card>
            );
          })}
          {(tables.data?.tables ?? []).length === 0 && (
            <Card className="flex flex-col items-center justify-center py-16 text-center sm:col-span-2 lg:col-span-4">
              <Grid3X3 className="mb-3 h-8 w-8 text-zinc-600" />
              <p className="text-sm text-zinc-400">No tables yet</p>
              <Button className="mt-4" size="sm" onClick={() => setModal(true)}>
                <Plus className="h-4 w-4" /> Add your first table
              </Button>
            </Card>
          )}
        </div>
      )}

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="Add table"
        description="Each table gets a unique QR code customers can scan."
      >
        <form onSubmit={save} className="space-y-4">
          <div>
            <Label htmlFor="t-number">Table number</Label>
            <Input
              id="t-number"
              type="number"
              required
              min={1}
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              placeholder="4"
            />
          </div>
          <div>
            <Label htmlFor="t-waiter">Assign waiter (optional)</Label>
            <Select id="t-waiter" value={waiterId} onChange={(e) => setWaiterId(e.target.value)}>
              <option value="">None</option>
              {waiters.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setModal(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Adding…" : "Add table"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={qrFor !== null}
        onClose={() => setQrFor(null)}
        title={`Table ${qrFor?.number} — QR menu`}
        description="Customers scan this to browse the menu and order from their seat."
      >
        {qrFor && (
          <div className="flex flex-col items-center">
            <div className="rounded-3xl border border-white/10 bg-white p-5">
              <QrCode url={tableUrl(qrFor.code)} size={220} />
            </div>
            <div className="mt-4 flex w-full items-center gap-2">
              <code className="flex-1 truncate rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-zinc-400">
                {tableUrl(qrFor.code)}
              </code>
              <a
                href={tableUrl(qrFor.code)}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl p-2.5 text-zinc-400 transition-colors hover:bg-white/10 hover:text-gold-light"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(tableUrl(qrFor.code));
                    toast.success("Link copied to clipboard");
                  } catch {
                    toast.error("Could not copy");
                  }
                }}
                className="rounded-xl p-2.5 text-zinc-400 transition-colors hover:bg-white/10 hover:text-gold-light"
                title="Copy link"
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-3 text-xs text-zinc-500">
              Tip: print this and place it on Table {qrFor.number}.
            </p>
          </div>
        )}
      </Modal>

      <Modal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Remove table?"
        description={`Table ${deleting?.number} and its QR code will be removed.`}
      >
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeleting(null)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={confirmDelete}>
            <Trash2 className="h-4 w-4" /> Remove
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function orderTone(status: string) {
  const map: Record<string, "amber" | "sky" | "violet" | "emerald" | "teal"> = {
    PENDING: "amber",
    ACCEPTED: "sky",
    COOKING: "violet",
    READY: "emerald",
    SERVED: "teal",
  };
  return map[status] ?? "amber";
}
