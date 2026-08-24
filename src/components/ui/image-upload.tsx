"use client";

import * as React from "react";
import { ImagePlus, Loader2, X, Link2, Images } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { FOOD_IMAGE_OPTIONS } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function ImageUpload({
  value,
  onChange,
}: {
  value: string;
  onChange: (url: string) => void;
}) {
  const [uploading, setUploading] = React.useState(false);
  const [showGallery, setShowGallery] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  async function onFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Upload failed");
      onChange(d.url);
      toast.success("Image uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      {value ? (
        <div className="group relative overflow-hidden rounded-2xl border border-white/10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt="Menu item"
            className="h-48 w-full object-cover"
          />
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/60 opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-medium text-white hover:bg-white/20"
            >
              Replace
            </button>
            <button
              type="button"
              onClick={() => onChange("")}
              className="rounded-full border border-rose-400/40 bg-rose-500/20 px-4 py-2 text-xs font-medium text-rose-200 hover:bg-rose-500/30"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex h-40 w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-white/15 bg-white/[0.02] text-zinc-400 transition-colors hover:border-gold/40 hover:text-gold-light"
        >
          {uploading ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <>
              <ImagePlus className="h-6 w-6" />
              <span className="text-sm">{uploading ? "Uploading…" : "Upload image"}</span>
              <span className="text-xs text-zinc-600">JPG · PNG · WEBP · up to 4MB</span>
            </>
          )}
        </button>
      )}

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

      <div className="mt-3">
        <div className="relative">
          <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <Input
            value={value.startsWith("http") || value.startsWith("/uploads") ? value : ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder="…or paste an image URL"
            className="pl-9"
          />
        </div>
        <button
          type="button"
          onClick={() => setShowGallery((s) => !s)}
          className="mt-2 inline-flex items-center gap-1.5 text-xs text-zinc-400 transition-colors hover:text-gold-light"
        >
          <Images className="h-3.5 w-3.5" />
          {showGallery ? "Hide" : "Pick from gallery"}
        </button>
        {showGallery && (
          <div className="mt-2 grid grid-cols-6 gap-2">
            {FOOD_IMAGE_OPTIONS.map((url) => (
              <button
                key={url}
                type="button"
                onClick={() => onChange(`${url}?auto=format&fit=crop&w=400&q=80`)}
                className={cn(
                  "overflow-hidden rounded-lg ring-2 transition-all",
                  value.includes(url)
                    ? "ring-gold"
                    : "ring-transparent hover:ring-white/25"
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`${url}?auto=format&fit=crop&w=120&q=60`} alt="" className="h-12 w-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
