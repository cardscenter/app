"use client";

import { useState, useCallback } from "react";
import { Upload, X } from "lucide-react";

/**
 * Card-shaped (portrait ≈ 5:7) single-image uploader. Gedeeld door de
 * claimsale-wizard-stappen (voor/achterkant per kaart/item).
 */
export function SingleImageUpload({
  image,
  onChange,
  label,
}: {
  image: string | null;
  onChange: (url: string | null) => void;
  label: string;
}) {
  const [uploading, setUploading] = useState(false);

  const upload = useCallback(
    async (file: File) => {
      setUploading(true);
      const formData = new FormData();
      formData.append("files", file);
      formData.append("context", "claimsale");
      try {
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        const data = await res.json();
        if (data.urls?.[0]) onChange(data.urls[0]);
      } catch {
        /* ignore */
      } finally {
        setUploading(false);
      }
    },
    [onChange]
  );

  if (image) {
    return (
      <div className="relative group w-full aspect-[5/7] rounded-lg overflow-hidden bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image} alt={label} className="h-full w-full object-cover" />
        <button
          type="button"
          onClick={() => onChange(null)}
          className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <X className="size-3.5" />
        </button>
        <div className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-medium uppercase text-white">
          {label}
        </div>
      </div>
    );
  }

  return (
    <label
      className={`flex cursor-pointer flex-col items-center justify-center w-full aspect-[5/7] rounded-lg border-2 border-dashed transition-all ${
        uploading
          ? "opacity-50 pointer-events-none"
          : "border-border hover:border-primary/50 hover:bg-muted/30"
      }`}
    >
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
      />
      <Upload className="size-5 text-muted-foreground/50" />
      <span className="mt-1 px-1 text-center text-[10px] font-medium leading-tight text-muted-foreground/60">
        {uploading ? "..." : label}
      </span>
    </label>
  );
}
