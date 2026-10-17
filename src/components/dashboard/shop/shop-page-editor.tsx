"use client";

import { useState, useTransition } from "react";
import { useRouter, Link } from "@/i18n/navigation";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronUp,
  Trash2,
  Plus,
  Save,
  Loader2,
  Type,
  Images,
  Star,
  Link2,
  Eye,
  EyeOff,
} from "lucide-react";
import { ImageUploader } from "@/components/ui/image-uploader";
import { Switch } from "@/components/ui/switch";
import { DashboardSection } from "@/components/dashboard/ui/section";
import { SettingsRow } from "@/components/dashboard/ui/settings-row";
import { updateShopPage } from "@/actions/shop";
import {
  MAX_SHOP_BLOCKS,
  SHOP_BLOCK_LABELS_NL,
  SHOP_BLOCK_TYPES,
  SHOP_BUSINESS_ONLY_BLOCKS,
  SHOP_TAGLINE_MAX,
  newShopBlockId,
  type ShopBlock,
  type ShopBlockType,
} from "@/lib/shop-config";
import { TextBlockEditor, GalleryBlockEditor, FeaturedBlockEditor, LinksBlockEditor } from "./block-editors";

type Props = {
  initial: {
    bannerUrl: string | null;
    tagline: string | null;
    published: boolean;
    blocks: ShopBlock[];
  };
  isBusiness: boolean;
  hasSlug: boolean;
  shopSlug: string | null;
};

const BLOCK_ICON: Record<ShopBlockType, typeof Type> = { TEXT: Type, GALLERY: Images, FEATURED: Star, LINKS: Link2 };

function emptyBlock(type: ShopBlockType): ShopBlock {
  const id = newShopBlockId();
  switch (type) {
    case "TEXT":
      return { id, type, heading: "", html: "" };
    case "GALLERY":
      return { id, type, images: [], caption: "" };
    case "FEATURED":
      return { id, type, heading: "", items: [] };
    case "LINKS":
      return { id, type, website: "", socialLinks: [], contact: "" };
  }
}

/**
 * Editor van de winkelpagina (/dashboard/winkel, Fase 45): banner + slogan +
 * gepubliceerd-schakelaar + blokkenlijst (toevoegen/verplaatsen/verwijderen,
 * inline formulier per type) en één "Opslaan" die alles in één payload naar
 * `updateShopPage` stuurt.
 */
export function ShopPageEditor({ initial, isBusiness, hasSlug, shopSlug }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [bannerUrl, setBannerUrl] = useState(initial.bannerUrl);
  const [tagline, setTagline] = useState(initial.tagline ?? "");
  const [published, setPublished] = useState(initial.published);
  const [blocks, setBlocks] = useState<ShopBlock[]>(initial.blocks);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mark = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setDirty(true);
  };

  const updateBlock = (id: string, next: ShopBlock) => {
    setBlocks((prev) => prev.map((b) => (b.id === id ? next : b)));
    setDirty(true);
  };
  const move = (index: number, dir: -1 | 1) => {
    setBlocks((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setDirty(true);
  };
  const remove = (id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
    setDirty(true);
  };
  const add = (type: ShopBlockType) => {
    if (blocks.length >= MAX_SHOP_BLOCKS) return;
    setBlocks((prev) => [...prev, emptyBlock(type)]);
    setDirty(true);
  };

  function save() {
    setError(null);
    const payload = {
      bannerUrl,
      tagline: tagline.trim() ? tagline.trim() : null,
      published,
      blocks: blocks.map((b) => {
        if (b.type === "LINKS") {
          return { ...b, socialLinks: b.socialLinks.filter((s) => s.trim()), website: b.website?.trim() || undefined };
        }
        return b;
      }),
    };
    const fd = new FormData();
    fd.set("payload", JSON.stringify(payload));
    startTransition(async () => {
      const res = await updateShopPage(fd);
      if ("error" in res && res.error) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      setDirty(false);
      toast.success("Winkelpagina opgeslagen");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <DashboardSection title="Banner & slogan" description="De brede afbeelding bovenaan je winkelpagina en de regel onder je naam.">
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-foreground">Banner</p>
            <p className="mb-2 text-xs text-muted-foreground">Bij voorkeur breed (≈5:1), max 5 MB. Zonder banner tonen we een kleurverloop in je level-kleur.</p>
            <ImageUploader images={bannerUrl ? [bannerUrl] : []} onChange={(imgs) => mark(setBannerUrl)(imgs[0] ?? null)} maxImages={1} context="shop" />
          </div>
          <div className="max-w-lg">
            <label htmlFor="tagline" className="text-sm font-medium text-foreground">
              Slogan
            </label>
            <input
              id="tagline"
              value={tagline}
              onChange={(e) => mark(setTagline)(e.target.value)}
              maxLength={SHOP_TAGLINE_MAX}
              placeholder="Vintage Pokémon-kaarten sinds 2009"
              className="mt-1 block w-full rounded-lg glass-input px-3 py-2 text-sm text-foreground"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {tagline.length}/{SHOP_TAGLINE_MAX}
            </p>
          </div>
        </div>
      </DashboardSection>

      <DashboardSection title="Zichtbaarheid" contentClassName="divide-y divide-border py-1 px-5">
        <SettingsRow
          label="Gepubliceerd"
          description={
            published
              ? "Je winkelpagina is zichtbaar voor iedereen op je winkel-URL."
              : "Concept: alleen jij ziet de pagina. Bezoekers krijgen een 404."
          }
          icon={published ? Eye : EyeOff}
          htmlFor="published"
        >
          <Switch id="published" checked={published} onCheckedChange={(v) => mark(setPublished)(v)} />
        </SettingsRow>
      </DashboardSection>

      <DashboardSection
        title="Blokken"
        description="Bouw je pagina op uit blokken. Verplaats ze met de pijltjes; de volgorde hier is de volgorde op de pagina."
        action={
          <span className="text-xs text-muted-foreground">
            {blocks.length}/{MAX_SHOP_BLOCKS}
          </span>
        }
      >
        <div className="space-y-4">
          {blocks.length === 0 && (
            <p className="rounded-dash border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
              Nog geen blokken. Voeg hieronder je eerste blok toe.
            </p>
          )}
          {blocks.map((block, index) => {
            const Icon = BLOCK_ICON[block.type];
            return (
              <div key={block.id} className="rounded-dash border border-border bg-background/50">
                <div className="flex items-center gap-2 border-b border-border px-3 py-2">
                  <Icon className="size-4 text-muted-foreground" />
                  <span className="flex-1 text-sm font-semibold text-foreground">
                    {index + 1}. {SHOP_BLOCK_LABELS_NL[block.type].label}
                  </span>
                  <button type="button" onClick={() => move(index, -1)} disabled={index === 0} className="rounded p-1 hover:bg-muted disabled:opacity-30" aria-label="Omhoog">
                    <ChevronUp className="size-4" />
                  </button>
                  <button type="button" onClick={() => move(index, 1)} disabled={index === blocks.length - 1} className="rounded p-1 hover:bg-muted disabled:opacity-30" aria-label="Omlaag">
                    <ChevronDown className="size-4" />
                  </button>
                  <button type="button" onClick={() => remove(block.id)} className="rounded p-1 text-rose-600 hover:bg-rose-500/10" aria-label="Verwijderen">
                    <Trash2 className="size-4" />
                  </button>
                </div>
                <div className="p-4">
                  {block.type === "TEXT" && <TextBlockEditor block={block} onChange={(b) => updateBlock(block.id, b)} />}
                  {block.type === "GALLERY" && <GalleryBlockEditor block={block} onChange={(b) => updateBlock(block.id, b)} />}
                  {block.type === "FEATURED" && <FeaturedBlockEditor block={block} onChange={(b) => updateBlock(block.id, b)} />}
                  {block.type === "LINKS" && <LinksBlockEditor block={block} isBusiness={isBusiness} onChange={(b) => updateBlock(block.id, b)} />}
                </div>
              </div>
            );
          })}

          <div>
            <p className="mb-2 text-sm font-medium text-foreground">Blok toevoegen</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {SHOP_BLOCK_TYPES.map((type) => {
                const Icon = BLOCK_ICON[type];
                const businessOnly = SHOP_BUSINESS_ONLY_BLOCKS.has(type);
                const disabled = blocks.length >= MAX_SHOP_BLOCKS || (businessOnly && !isBusiness);
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => add(type)}
                    disabled={disabled}
                    className="flex items-start gap-3 rounded-dash border border-dashed border-border p-3 text-left transition hover:border-primary hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border disabled:hover:bg-transparent"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-1 text-sm font-medium text-foreground">
                        <Plus className="size-3.5" /> {SHOP_BLOCK_LABELS_NL[type].label}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {businessOnly && !isBusiness ? "Alleen voor bedrijfspagina's" : SHOP_BLOCK_LABELS_NL[type].description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </DashboardSection>

      {/* Sticky opslaan-balk */}
      <div className="sticky bottom-4 z-10">
        <div className="dash-card flex flex-wrap items-center justify-between gap-3 p-3 shadow-lg">
          <p className="text-sm text-muted-foreground">
            {dirty ? "Niet-opgeslagen wijzigingen" : "Alles opgeslagen"}
            {!hasSlug && " · stel eerst een winkel-URL in om de pagina te kunnen bekijken"}
          </p>
          <div className="flex items-center gap-2">
            {hasSlug && shopSlug && (
              <Link href={`/winkel/${shopSlug}`} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted">
                Bekijk
              </Link>
            )}
            <button
              type="button"
              onClick={save}
              disabled={pending || !dirty}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover disabled:opacity-50"
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Opslaan
            </button>
          </div>
          {error && <p className="w-full text-sm text-rose-600">{error}</p>}
        </div>
      </div>
    </div>
  );
}
