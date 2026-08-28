"use client";

import * as React from "react";
import {
  Plus,
  Trash2,
  Pencil,
  Search,
  UtensilsCrossed,
  Flame,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ImageUpload } from "@/components/ui/image-upload";
import { formatCurrency } from "@/lib/utils";
import { useFetch } from "@/lib/use-fetch";
import { useRealtime } from "@/components/realtime/use-realtime";
import { useDebouncedCallback } from "@/lib/use-debounced";

type MenuItem = {
  id: string;
  name: string;
  description: string | null;
  ingredients: string;
  price: number;
  imageUrl: string | null;
  available: boolean;
  isPopular: boolean;
  categoryId: string | null;
  category: { id: string; name: string } | null;
};

type Category = { id: string; name: string; sortOrder: number };

type MenuData = { items: MenuItem[]; categories: Category[] };

const EMPTY_FORM = {
  name: "",
  description: "",
  ingredients: "",
  price: "",
  imageUrl: "",
  categoryId: "",
  categoryName: "",
  available: true,
  isPopular: false,
};

export default function ManagerMenu() {
  const { data, loading, refresh } = useFetch<MenuData>("/api/menu");
  const [restaurantId, setRestaurantId] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [filterCat, setFilterCat] = React.useState("all");
  const [modal, setModal] = React.useState<null | { mode: "create" } | { mode: "edit"; item: MenuItem }>(null);
  const [deleting, setDeleting] = React.useState<MenuItem | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState(EMPTY_FORM);
  const refreshDebounced = useDebouncedCallback(refresh, 250);

  useRealtime(
    restaurantId ? [{ scope: "restaurant", id: restaurantId }] : [],
    () => refreshDebounced()
  );

  React.useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => setRestaurantId(d.user?.restaurantId ?? null))
      .catch(() => {});
  }, []);

  function set<K extends keyof typeof EMPTY_FORM>(key: K, value: (typeof EMPTY_FORM)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function openCreate() {
    setForm(EMPTY_FORM);
    setModal({ mode: "create" });
  }

  function openEdit(item: MenuItem) {
    setForm({
      name: item.name,
      description: item.description ?? "",
      ingredients: item.ingredients,
      price: String(item.price),
      imageUrl: item.imageUrl ?? "",
      categoryId: item.categoryId ?? "",
      categoryName: "",
      available: item.available,
      isPopular: item.isPopular,
    });
    setModal({ mode: "edit", item });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        description: form.description,
        ingredients: form.ingredients,
        price: Number(form.price),
        imageUrl: form.imageUrl,
        available: form.available,
        isPopular: form.isPopular,
        categoryId: form.categoryId || undefined,
        categoryName: form.categoryName || undefined,
      };
      const url =
        modal?.mode === "create"
          ? "/api/menu"
          : `/api/menu/${(modal as { item: MenuItem }).item.id}`;
      const res = await fetch(url, {
        method: modal?.mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Failed");
      toast.success(modal?.mode === "create" ? "Menu item added" : "Menu item updated");
      setModal(null);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    try {
      const res = await fetch(`/api/menu/${deleting.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      toast.success("Menu item removed");
      setDeleting(null);
      refresh();
    } catch {
      toast.error("Failed to delete");
    }
  }

  const items =
    data?.items.filter((i) => {
      const q = search.toLowerCase();
      const matchSearch =
        i.name.toLowerCase().includes(q) ||
        i.ingredients.toLowerCase().includes(q) ||
        (i.description ?? "").toLowerCase().includes(q);
      const matchCat = filterCat === "all" || i.categoryId === filterCat;
      return matchSearch && matchCat;
    }) ?? [];

  return (
    <div>
      <PageHeader
        title="Menu"
        description="Curate your dishes — pictures, ingredients, prices, availability."
        action={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> New dish
          </Button>
        }
      />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search dishes, ingredients…"
            className="pl-10"
          />
        </div>
        <Select
          value={filterCat}
          onChange={(e) => setFilterCat(e.target.value)}
          className="sm:w-52"
        >
          <option value="all">All categories</option>
          {data?.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-72" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((item) => (
            <Card
              key={item.id}
              className="group overflow-hidden p-0 transition-all hover:-translate-y-0.5 hover:border-gold/30"
            >
              <div className="relative h-40 overflow-hidden">
                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-gold/15 to-transparent">
                    <UtensilsCrossed className="h-10 w-10 text-gold-dark/40 dark:text-gold-light/40" />
                  </div>
                )}
                {!item.available && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-[2px]">
                    <Badge tone="rose">Unavailable</Badge>
                  </div>
                )}
                {item.isPopular && (
                  <div className="absolute left-3 top-3">
                    <Badge tone="gold">
                      <Flame className="h-3 w-3" /> Popular
                    </Badge>
                  </div>
                )}
              </div>

              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-display text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                    {item.name}
                  </h3>
                  <p className="shrink-0 font-display text-lg font-semibold text-gold-dark dark:text-gold-light">
                    {formatCurrency(item.price)}
                  </p>
                </div>
                {item.category && (
                  <p className="mt-0.5 text-xs uppercase tracking-wide text-zinc-500">
                    {item.category.name}
                  </p>
                )}
                <p className="mt-2 line-clamp-2 text-sm text-zinc-500 dark:text-zinc-400">
                  {item.description ?? "—"}
                </p>
                <p className="mt-2 line-clamp-1 text-xs text-zinc-500">
                  <span className="text-zinc-600 dark:text-zinc-400">Ingredients:</span> {item.ingredients}
                </p>

                <div className="mt-4 flex items-center justify-between border-t border-zinc-200 pt-3 dark:border-white/[0.06]">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-500">Available</span>
                    <Switch
                      checked={item.available}
                      onCheckedChange={async (v) => {
                        const res = await fetch(`/api/menu/${item.id}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ available: v }),
                        });
                        if (res.ok) {
                          toast.success(v ? "Item is now available" : "Item hidden");
                          refresh();
                        }
                      }}
                    />
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => openEdit(item)}
                      className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-200 hover:text-gold-dark dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-gold-light"
                      title="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setDeleting(item)}
                      className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-200 hover:text-rose-700 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-rose-300"
                      title="Remove"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
          {items.length === 0 && (
            <Card className="flex flex-col items-center justify-center py-16 text-center sm:col-span-2 lg:col-span-4">
              <UtensilsCrossed className="mb-3 h-8 w-8 text-zinc-600" />
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {data?.items.length === 0 ? "Your menu is empty" : "No matching dishes"}
              </p>
              {data?.items.length === 0 && (
                <Button className="mt-4" size="sm" onClick={openCreate}>
                  <Plus className="h-4 w-4" /> Add your first dish
                </Button>
              )}
            </Card>
          )}
        </div>
      )}

      <Modal
        open={modal !== null}
        onClose={() => setModal(null)}
        title={modal?.mode === "create" ? "New dish" : "Edit dish"}
        description="Pictures, ingredients and pricing — everything customers see."
        className="max-w-xl"
      >
        <form onSubmit={save} className="space-y-4">
          <ImageUpload value={form.imageUrl} onChange={(url) => set("imageUrl", url)} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="m-name">Dish name</Label>
              <Input id="m-name" required value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Ribeye Steak" />
            </div>
            <div>
              <Label htmlFor="m-price">Price ($)</Label>
              <Input id="m-price" type="number" step="0.01" min="0" required value={form.price} onChange={(e) => set("price", e.target.value)} placeholder="24.00" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="m-cat">Category</Label>
              <Select id="m-cat" value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
                <option value="">Uncategorized</option>
                {data?.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="m-cat-new">…or new category</Label>
              <Input id="m-cat-new" value={form.categoryName} onChange={(e) => set("categoryName", e.target.value)} placeholder="New category name" />
            </div>
          </div>
          <div>
            <Label htmlFor="m-ingredients">Ingredients</Label>
            <Input id="m-ingredients" required value={form.ingredients} onChange={(e) => set("ingredients", e.target.value)} placeholder="Beef, garlic butter, rosemary" />
          </div>
          <div>
            <Label htmlFor="m-desc">Description</Label>
            <Textarea id="m-desc" value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="A short, tempting description…" />
          </div>
          <div className="flex gap-6">
            <label className="flex cursor-pointer items-center gap-2.5 text-sm text-zinc-600 dark:text-zinc-300">
              <Switch checked={form.available} onCheckedChange={(v) => set("available", v)} />
              Available
            </label>
            <label className="flex cursor-pointer items-center gap-2.5 text-sm text-zinc-600 dark:text-zinc-300">
              <Switch checked={form.isPopular} onCheckedChange={(v) => set("isPopular", v)} />
              Mark as popular
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setModal(null)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : modal?.mode === "create" ? "Add dish" : "Save changes"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Remove dish?"
        description={`"${deleting?.name}" will be removed from the menu.`}
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
