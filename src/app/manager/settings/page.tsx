"use client";

import * as React from "react";
import { Camera, Loader2, RefreshCw, Save, Store, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/stat-card";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRealtime } from "@/components/realtime/use-realtime";

type Restaurant = {
  id: string;
  name: string;
  logoUrl: string | null;
};

export default function ManagerSettings() {
  const [restaurant, setRestaurant] = React.useState<Restaurant | null>(null);
  const [logoUrl, setLogoUrl] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const load = React.useCallback(() => {
    fetch("/api/me/restaurant")
      .then((r) => r.json())
      .then((d) => {
        if (d.restaurant) {
          setRestaurant(d.restaurant);
          setLogoUrl(d.restaurant.logoUrl);
        }
      })
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  useRealtime(restaurant?.id ? [{ scope: "restaurant", id: restaurant.id }] : [], load);

  const dirty = logoUrl !== (restaurant?.logoUrl ?? null);

  async function onFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      toast.error("Image must be under 4MB");
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Upload failed");
      setLogoUrl(d.url);
      toast.success("Logo uploaded — click Save to apply");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/me/restaurant", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logoUrl }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Could not save the logo");
      setRestaurant(d.restaurant);
      toast.success("Restaurant logo updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the logo");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Restaurant settings"
        description="Set the logo that represents your restaurant across the whole workspace."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-start gap-5">
            <div className="relative">
              {logoUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={logoUrl}
                  alt={`${restaurant?.name ?? "Restaurant"} logo`}
                  className="h-24 w-24 rounded-2xl border border-zinc-200 object-cover shadow-soft dark:border-white/10"
                />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-2xl border border-dashed border-zinc-200 bg-zinc-100 dark:border-white/15 dark:bg-white/[0.02]">
                  <Store className="h-9 w-9 text-zinc-500" />
                </div>
              )}
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
                className="absolute -bottom-2 -right-2 flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-600 shadow-soft transition-colors hover:border-gold/40 hover:text-gold-dark dark:border-white/10 dark:bg-[#141416] dark:text-zinc-300 dark:hover:text-gold-light"
                title={logoUrl ? "Replace logo" : "Upload logo"}
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="h-4 w-4" />
                )}
              </button>
            </div>

            <div className="min-w-0 flex-1">
              <h2 className="font-display text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                {restaurant?.name ?? "Loading…"}
              </h2>
              <p className="mt-1 text-sm text-zinc-500">
                Your logo shows up in the sidebar and header of every staff member at this
                restaurant.
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button
                  onClick={save}
                  disabled={!dirty || saving || uploading}
                  size="sm"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save logo
                </Button>
                {logoUrl && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-rose-700 hover:bg-rose-500/10 dark:text-rose-300"
                    onClick={() => setLogoUrl(null)}
                    disabled={saving}
                  >
                    <Trash2 className="h-4 w-4" /> Remove
                  </Button>
                )}
                {dirty && (
                  <Button
                    variant="subtle"
                    size="sm"
                    onClick={() => setLogoUrl(restaurant?.logoUrl ?? null)}
                    disabled={saving}
                  >
                    <RefreshCw className="h-4 w-4" /> Reset
                  </Button>
                )}
              </div>
            </div>
          </div>
        </Card>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
