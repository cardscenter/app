"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Loader2 } from "lucide-react";
import { ImageUploader } from "@/components/ui/image-uploader";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { detectSocialPlatform } from "@/lib/events/socials";
import { SocialIcon } from "@/components/events/social-icon";
import { richTextLength } from "@/lib/sanitize-html";
import { listOwnFeaturableItems, type FeaturableItem } from "@/actions/shop";
import {
  MAX_SOCIAL_LINKS,
  SHOP_FEATURED_MAX,
  SHOP_GALLERY_CAPTION_MAX,
  SHOP_GALLERY_MAX,
  SHOP_HEADING_MAX,
  SHOP_LINKS_TEXT_MAX,
  SHOP_TEXT_MAX,
  type ShopBlock,
} from "@/lib/shop-config";

const input = "mt-1 block w-full rounded-lg glass-input px-3 py-2 text-sm text-foreground";
const label = "text-sm font-medium text-foreground";
const hint = "mt-1 text-xs text-muted-foreground";

type TextBlock = Extract<ShopBlock, { type: "TEXT" }>;
type GalleryBlock = Extract<ShopBlock, { type: "GALLERY" }>;
type FeaturedBlock = Extract<ShopBlock, { type: "FEATURED" }>;
type LinksBlock = Extract<ShopBlock, { type: "LINKS" }>;

export function TextBlockEditor({ block, onChange }: { block: TextBlock; onChange: (b: TextBlock) => void }) {
  const len = richTextLength(block.html);
  return (
    <div className="space-y-3">
      <div>
        <label className={label}>Kop (optioneel)</label>
        <input
          value={block.heading ?? ""}
          onChange={(e) => onChange({ ...block, heading: e.target.value })}
          maxLength={SHOP_HEADING_MAX}
          placeholder="Over ons"
          className={input}
        />
      </div>
      <div>
        <label className={label}>Tekst</label>
        <RichTextEditor value={block.html} onChange={(html) => onChange({ ...block, html })} rows={6} placeholder="Vertel iets over je winkel…" />
        <p className={`${hint} ${len > SHOP_TEXT_MAX ? "text-rose-600" : ""}`}>
          {len}/{SHOP_TEXT_MAX} tekens
        </p>
      </div>
    </div>
  );
}

export function GalleryBlockEditor({ block, onChange }: { block: GalleryBlock; onChange: (b: GalleryBlock) => void }) {
  return (
    <div className="space-y-3">
      <div>
        <label className={label}>Foto&apos;s (max {SHOP_GALLERY_MAX})</label>
        <div className="mt-1">
          <ImageUploader images={block.images} onChange={(images) => onChange({ ...block, images })} maxImages={SHOP_GALLERY_MAX} context="shop" />
        </div>
      </div>
      <div>
        <label className={label}>Bijschrift (optioneel)</label>
        <input
          value={block.caption ?? ""}
          onChange={(e) => onChange({ ...block, caption: e.target.value })}
          maxLength={SHOP_GALLERY_CAPTION_MAX}
          placeholder="Onze stand op de beurs in Utrecht"
          className={input}
        />
      </div>
    </div>
  );
}

const TYPE_LABEL: Record<FeaturableItem["type"], string> = { listing: "Advertentie", auction: "Veiling", claimsale: "Claimsale" };

export function FeaturedBlockEditor({ block, onChange }: { block: FeaturedBlock; onChange: (b: FeaturedBlock) => void }) {
  const [items, setItems] = useState<FeaturableItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listOwnFeaturableItems().then((res) => {
      if (cancelled) return;
      if ("error" in res) setError(res.error);
      else setItems(res.items);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = new Set(block.items.map((it) => `${it.type}:${it.id}`));
  const toggle = (it: FeaturableItem) => {
    const key = `${it.type}:${it.id}`;
    if (selected.has(key)) {
      onChange({ ...block, items: block.items.filter((x) => `${x.type}:${x.id}` !== key) });
    } else if (block.items.length < SHOP_FEATURED_MAX) {
      onChange({ ...block, items: [...block.items, { type: it.type, id: it.id }] });
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <label className={label}>Kop (optioneel)</label>
        <input
          value={block.heading ?? ""}
          onChange={(e) => onChange({ ...block, heading: e.target.value })}
          maxLength={SHOP_HEADING_MAX}
          placeholder="Uitgelicht"
          className={input}
        />
      </div>
      <div>
        <div className="flex items-center justify-between">
          <label className={label}>Kies items ({block.items.length}/{SHOP_FEATURED_MAX})</label>
          <span className="text-xs text-muted-foreground">Alleen actief/gepland aanbod</span>
        </div>
        {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
        {!items && !error && (
          <p className="mt-2 inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Aanbod laden…
          </p>
        )}
        {items && items.length === 0 && <p className="mt-2 text-sm text-muted-foreground">Je hebt nog geen actief aanbod om uit te lichten.</p>}
        {items && items.length > 0 && (
          <div className="mt-2 grid max-h-80 grid-cols-2 gap-2 overflow-y-auto rounded-lg border border-border p-2 sm:grid-cols-3">
            {items.map((it) => {
              const key = `${it.type}:${it.id}`;
              const on = selected.has(key);
              const full = !on && block.items.length >= SHOP_FEATURED_MAX;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggle(it)}
                  disabled={full}
                  className={`flex items-center gap-2 rounded-md border p-2 text-left text-xs transition ${
                    on ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                  } disabled:opacity-40`}
                >
                  <div className="relative size-10 shrink-0 overflow-hidden rounded bg-muted">
                    {it.image && <Image src={it.image} alt="" fill className="object-cover" sizes="40px" unoptimized />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 font-medium text-foreground">{it.title}</p>
                    <p className="text-muted-foreground">
                      {TYPE_LABEL[it.type]}
                      {it.price != null ? ` · €${it.price.toFixed(2)}` : ""}
                    </p>
                  </div>
                  <input type="checkbox" readOnly checked={on} className="accent-primary" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export function LinksBlockEditor({
  block,
  isBusiness,
  onChange,
}: {
  block: LinksBlock;
  isBusiness: boolean;
  onChange: (b: LinksBlock) => void;
}) {
  const socials = block.socialLinks.length < MAX_SOCIAL_LINKS ? [...block.socialLinks, ""] : block.socialLinks;
  const setSocial = (i: number, value: string) => {
    const next = [...socials];
    next[i] = value;
    onChange({ ...block, socialLinks: next.filter((s) => s.trim().length > 0).slice(0, MAX_SOCIAL_LINKS) });
  };
  return (
    <div className="space-y-3">
      <div>
        <label className={label}>Website</label>
        <input value={block.website ?? ""} onChange={(e) => onChange({ ...block, website: e.target.value })} placeholder="https://" className={input} />
      </div>
      <div>
        <label className={label}>Socials (max {MAX_SOCIAL_LINKS})</label>
        <div className="mt-1 space-y-2">
          {socials.map((url, i) => {
            const det = url ? detectSocialPlatform(url) : null;
            return (
              <div key={i} className="flex items-center gap-2">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  {det ? <SocialIcon platform={det.platform} className="size-4" /> : <span className="text-xs">+</span>}
                </span>
                <input value={url} onChange={(e) => setSocial(i, e.target.value)} placeholder="https://instagram.com/…" className={`${input} mt-0`} />
                {det && <span className="w-16 shrink-0 text-xs text-muted-foreground">{det.label}</span>}
              </div>
            );
          })}
        </div>
      </div>
      <div>
        <label className={label}>Contact (optioneel)</label>
        <textarea
          value={block.contact ?? ""}
          onChange={(e) => onChange({ ...block, contact: e.target.value })}
          maxLength={SHOP_LINKS_TEXT_MAX}
          rows={2}
          placeholder="Bereikbaar via de chat of op beurzen"
          className={input}
        />
      </div>
      {isBusiness && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={label}>Standplaats / winkeladres</label>
            <textarea
              value={block.standLocation ?? ""}
              onChange={(e) => onChange({ ...block, standLocation: e.target.value })}
              maxLength={SHOP_LINKS_TEXT_MAX}
              rows={2}
              placeholder="Hal 3, stand 12 op de Cards Fair Utrecht"
              className={input}
            />
          </div>
          <div>
            <label className={label}>Openingstijden</label>
            <textarea
              value={block.openingHours ?? ""}
              onChange={(e) => onChange({ ...block, openingHours: e.target.value })}
              maxLength={SHOP_LINKS_TEXT_MAX}
              rows={2}
              placeholder={"ma–vr 10:00–18:00\nza 10:00–17:00"}
              className={input}
            />
          </div>
        </div>
      )}
    </div>
  );
}
