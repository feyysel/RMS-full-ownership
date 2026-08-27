"use client";

import * as React from "react";
import { Store, Plus, Grid3X3, UtensilsCrossed, Users, ArrowRight, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { useFetch } from "@/lib/use-fetch";
import { useRealtime } from "@/components/realtime/use-realtime";
import { useDebouncedCallback } from "@/lib/use-debounced";

type BranchRestaurant = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  parentId: string | null;
  createdAt: string;
  _count: { users: number; tables: number; menuItems: number };
};

type BranchesData = {
  restaurants: BranchRestaurant[];
  activeRestaurantId: string;
  canCreateBranches: boolean;
};

export default function ManagerBranches() {
  const router = useRouter();
  const { data, loading, refresh } = useFetch<BranchesData>("/api/manager/branches");
  const refreshDebounced = useDebouncedCallback(refresh, 500);
  const activeRestaurantId = data?.activeRestaurantId ?? null;
  useRealtime(
    activeRestaurantId ? [{ scope: "restaurant", id: activeRestaurantId }] : [],
    () => refreshDebounced()
  );
  const [modal, setModal] = React.useState(false);
  const [switching, setSwitching] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const [name, setName] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [phone, setPhone] = React.useState("");

  function openModal() {
    setName("");
    setAddress("");
    setPhone("");
    setModal(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/manager/branches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, address, phone }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Failed");
      toast.success("Branch created");
      setModal(false);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function switchTo(restaurantId: string) {
    setSwitching(restaurantId);
    try {
      const res = await fetch("/api/manager/switch-restaurant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Failed");
      toast.success("Switched");
      router.push("/manager");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSwitching(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="My Restaurants"
        description="Manage your main restaurant and its branches."
        action={
          data?.canCreateBranches ? (
            <Button onClick={openModal}>
              <Plus className="h-4 w-4" />
              Add branch
            </Button>
          ) : undefined
        }
      />

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data?.restaurants.map((r) => {
            const active = r.id === data.activeRestaurantId;
            return (
              <Card key={r.id} className="flex flex-col overflow-hidden transition-all hover:border-gold/30">
                <div className="mb-4 flex items-start justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-gold/20 to-gold/5 text-gold-light ring-1 ring-gold/25">
                    <Store className="h-6 w-6" />
                  </div>
                  <div className="flex gap-1.5">
                    {active && <Badge tone="emerald">Active now</Badge>}
                    {!r.parentId && <Badge tone="gold">Main</Badge>}
                  </div>
                </div>
                <h3 className="font-display text-xl font-semibold text-zinc-50">{r.name}</h3>
                <p className="mt-1 line-clamp-1 text-sm text-zinc-500">
                  {r.address ?? "No address"} {r.phone ? `· ${r.phone}` : ""}
                </p>

                <div className="mt-5 grid grid-cols-3 gap-2">
                  {[
                    { icon: Users, label: "Staff", value: r._count.users },
                    { icon: Grid3X3, label: "Tables", value: r._count.tables },
                    { icon: UtensilsCrossed, label: "Menu", value: r._count.menuItems },
                  ].map((m) => (
                    <div key={m.label} className="rounded-xl bg-white/[0.04] px-2.5 py-2.5 text-center">
                      <m.icon className="mx-auto mb-1 h-4 w-4 text-gold-light/70" />
                      <p className="text-sm font-semibold text-zinc-100">{m.value}</p>
                      <p className="text-[10px] uppercase tracking-wide text-zinc-500">{m.label}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-white/[0.06] pt-4">
                  <p className="text-xs text-zinc-500">Since {formatDate(r.createdAt)}</p>
                  {active ? (
                    <Button size="sm" variant="outline" disabled>
                      <RefreshCw className="h-3.5 w-3.5" /> Managing
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => switchTo(r.id)} disabled={switching === r.id}>
                      {switching === r.id ? (
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <ArrowRight className="h-3.5 w-3.5" />
                      )}
                      Manage
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
          {data?.restaurants.length === 0 && (
            <Card className="flex flex-col items-center justify-center py-16 text-center sm:col-span-2 lg:col-span-3">
              <Store className="mb-3 h-8 w-8 text-zinc-600" />
              <p className="text-sm text-zinc-400">No restaurants assigned</p>
            </Card>
          )}
        </div>
      )}

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="Add a new branch"
        description="As the owner, you can create branches instantly — no approval needed."
      >
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="b-name">Branch name</Label>
            <Input id="b-name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="The Golden Fork — Airport" />
          </div>
          <div>
            <Label htmlFor="b-address">Address</Label>
            <Textarea id="b-address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="12 Terminal Road" />
          </div>
          <div>
            <Label htmlFor="b-phone">Phone</Label>
            <Input id="b-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 (555) 987-6543" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setModal(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Creating…" : "Create branch"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
