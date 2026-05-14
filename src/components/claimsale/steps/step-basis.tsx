"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { ImageIcon, X, Layers, Package } from "lucide-react";
import type { ClaimsaleType } from "../wizard-types";

interface StepBasisProps {
  type: ClaimsaleType;
  coverImage: string | null;
  title: string;
  description: string;
  hasItems: boolean;
  onChange: (field: string, value: unknown) => void;
  onTypeChange: (next: ClaimsaleType) => void;
}

export function StepBasis({
  type,
  coverImage,
  title,
  description,
  hasItems,
  onChange,
  onTypeChange,
}: StepBasisProps) {
  const t = useTranslations("claimsale");
  const [coverUploading, setCoverUploading] = useState(false);

  const uploadCover = useCallback(
    async (file: File) => {
      setCoverUploading(true);
      const formData = new FormData();
      formData.append("files", file);
      formData.append("context", "claimsale");
      try {
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        const data = await res.json();
        if (data.urls?.[0]) onChange("coverImage", data.urls[0]);
      } catch {
        /* ignore */
      } finally {
        setCoverUploading(false);
      }
    },
    [onChange]
  );

  const handleTypeClick = (next: ClaimsaleType) => {
    if (next === type) return;
    if (hasItems && !confirm(t("typeChangeWarning"))) return;
    onTypeChange(next);
  };

  const TYPE_OPTIONS: { value: ClaimsaleType; icon: typeof Layers; labelKey: string; descKey: string }[] = [
    { value: "CARDS", icon: Layers, labelKey: "typeCards", descKey: "typeCardsDesc" },
    { value: "ITEMS", icon: Package, labelKey: "typeItems", descKey: "typeItemsDesc" },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-foreground">{t("stepBasis")}</h2>

      <div className="flex flex-col gap-6 sm:flex-row">
        {/* Cover image */}
        <div className="w-full shrink-0 sm:w-48">
          <label className="mb-2 block text-sm font-medium text-foreground">{t("thumbnail")}</label>
          {coverImage ? (
            <div className="group relative aspect-square overflow-hidden rounded-xl bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={coverImage} alt="Cover" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => onChange("coverImage", null)}
                className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
              >
                <X className="size-4" />
              </button>
            </div>
          ) : (
            <label
              className={`flex aspect-square cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition-all ${
                coverUploading
                  ? "pointer-events-none opacity-50"
                  : "border-border hover:border-primary/50 hover:bg-muted/30"
              }`}
            >
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(e) => e.target.files?.[0] && uploadCover(e.target.files[0])}
              />
              <ImageIcon className="size-10 text-muted-foreground/50" />
              <span className="mt-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">
                {coverUploading ? "..." : t("thumbnail")}
              </span>
            </label>
          )}
        </div>

        {/* Title + description */}
        <div className="flex-1 space-y-4">
          <div>
            <label htmlFor="cs-title" className="block text-sm font-medium text-foreground">
              {t("title")}
            </label>
            <input
              id="cs-title"
              type="text"
              value={title}
              onChange={(e) => onChange("title", e.target.value)}
              className="mt-1 block w-full glass-input px-3 py-2.5 text-foreground"
            />
          </div>
          <div>
            <label htmlFor="cs-description" className="block text-sm font-medium text-foreground">
              {t("description")}
            </label>
            <textarea
              id="cs-description"
              rows={3}
              value={description}
              onChange={(e) => onChange("description", e.target.value)}
              className="mt-1 block w-full glass-input px-3 py-2.5 text-foreground"
            />
          </div>
        </div>
      </div>

      {/* Type selector */}
      <div>
        <label className="mb-2 block text-sm font-medium text-foreground">{t("typeLabel")}</label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {TYPE_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const selected = type === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleTypeClick(opt.value)}
                className={`flex items-start gap-3 rounded-2xl border-2 p-4 text-left transition-all ${
                  selected
                    ? "border-primary bg-primary/10 shadow-md"
                    : "glass-subtle border-transparent hover:border-primary/30 hover:bg-muted"
                }`}
              >
                <Icon className={`mt-0.5 h-6 w-6 shrink-0 ${selected ? "text-primary" : "text-muted-foreground"}`} />
                <div>
                  <div className={`font-medium ${selected ? "text-primary" : "text-foreground"}`}>
                    {t(opt.labelKey)}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{t(opt.descKey)}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
