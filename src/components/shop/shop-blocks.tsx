import Image from "next/image";
import { Globe, MapPin, Clock, Mail } from "lucide-react";
import { detectSocialPlatform } from "@/lib/events/socials";
import { SocialIcon } from "@/components/events/social-icon";
import { sanitizeRichText, richTextClassName } from "@/lib/sanitize-html";
import type { ShopBlock } from "@/lib/shop-config";
import type { ResolvedFeatured } from "@/lib/shop-featured";
import { ListingCard } from "@/components/listing/listing-card";
import { AuctionCard } from "@/components/auction/auction-card";
import { ClaimsaleCard } from "@/components/claimsale/claimsale-card";

type Props = {
  blocks: ShopBlock[];
  resolved: ResolvedFeatured;
  locale: string;
  buyer?: { country: string | null; postalCode: string | null } | null;
};

/** Renderer van de winkelpagina-blokken (Fase 45). Server component. */
export function ShopBlocks({ blocks, resolved, locale, buyer }: Props) {
  return (
    <div className="space-y-5">
      {blocks.map((block) => {
        switch (block.type) {
          case "TEXT":
            return <TextBlock key={block.id} block={block} />;
          case "GALLERY":
            return <GalleryBlock key={block.id} block={block} />;
          case "FEATURED":
            return <FeaturedBlock key={block.id} block={block} resolved={resolved} locale={locale} buyer={buyer} />;
          case "LINKS":
            return <LinksBlock key={block.id} block={block} />;
          default:
            return null;
        }
      })}
    </div>
  );
}

function BlockCard({ heading, children }: { heading?: string; children: React.ReactNode }) {
  return (
    <section className="dash-card p-5 sm:p-6">
      {heading && <h2 className="mb-3 text-lg font-semibold text-foreground">{heading}</h2>}
      {children}
    </section>
  );
}

function TextBlock({ block }: { block: Extract<ShopBlock, { type: "TEXT" }> }) {
  return (
    <BlockCard heading={block.heading}>
      <div className={richTextClassName} dangerouslySetInnerHTML={{ __html: sanitizeRichText(block.html) }} />
    </BlockCard>
  );
}

function GalleryBlock({ block }: { block: Extract<ShopBlock, { type: "GALLERY" }> }) {
  return (
    <BlockCard>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {block.images.map((src, i) => (
          <div key={`${src}-${i}`} className="relative aspect-[4/3] overflow-hidden rounded-lg bg-muted">
            <Image src={src} alt={block.caption ?? ""} fill className="object-cover" sizes="(min-width: 640px) 33vw, 50vw" unoptimized />
          </div>
        ))}
      </div>
      {block.caption && <p className="mt-3 text-sm text-muted-foreground">{block.caption}</p>}
    </BlockCard>
  );
}

function FeaturedBlock({
  block,
  resolved,
  locale,
  buyer,
}: {
  block: Extract<ShopBlock, { type: "FEATURED" }>;
  resolved: ResolvedFeatured;
  locale: string;
  buyer?: { country: string | null; postalCode: string | null } | null;
}) {
  const cards = block.items
    .map((it) => {
      if (it.type === "listing") {
        const l = resolved.listings.get(it.id);
        return l ? <ListingCard key={`l-${l.id}`} listing={l} locale={locale} buyer={buyer} /> : null;
      }
      if (it.type === "auction") {
        const a = resolved.auctions.get(it.id);
        return a ? <AuctionCard key={`a-${a.id}`} auction={a} buyer={buyer} /> : null;
      }
      const c = resolved.claimsales.get(it.id);
      return c ? <ClaimsaleCard key={`c-${c.id}`} claimsale={c} buyer={buyer} /> : null;
    })
    .filter(Boolean);
  if (cards.length === 0) return null;
  return (
    <BlockCard heading={block.heading}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{cards}</div>
    </BlockCard>
  );
}

function LinksBlock({ block }: { block: Extract<ShopBlock, { type: "LINKS" }> }) {
  const rows: { icon: React.ReactNode; label: string; body: React.ReactNode }[] = [];
  if (block.website) {
    rows.push({
      icon: <Globe className="size-4" />,
      label: "Website",
      body: (
        <a href={block.website} target="_blank" rel="noopener noreferrer nofollow" className="text-primary hover:underline">
          {block.website.replace(/^https?:\/\//i, "")}
        </a>
      ),
    });
  }
  if (block.contact) rows.push({ icon: <Mail className="size-4" />, label: "Contact", body: <span className="whitespace-pre-line">{block.contact}</span> });
  if (block.standLocation) rows.push({ icon: <MapPin className="size-4" />, label: "Standplaats", body: <span className="whitespace-pre-line">{block.standLocation}</span> });
  if (block.openingHours) rows.push({ icon: <Clock className="size-4" />, label: "Openingstijden", body: <span className="whitespace-pre-line">{block.openingHours}</span> });

  if (rows.length === 0 && block.socialLinks.length === 0) return null;

  return (
    <BlockCard>
      <dl className="space-y-3">
        {rows.map((r) => (
          <div key={r.label} className="flex items-start gap-3 text-sm">
            <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">{r.icon}</span>
            <div className="min-w-0">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{r.label}</dt>
              <dd className="mt-0.5 text-foreground">{r.body}</dd>
            </div>
          </div>
        ))}
      </dl>
      {block.socialLinks.length > 0 && (
        <div className={`flex flex-wrap gap-2 ${rows.length > 0 ? "mt-4" : ""}`}>
          {block.socialLinks.map((url) => {
            const { label, platform } = detectSocialPlatform(url);
            return (
              <a
                key={url}
                href={url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                <SocialIcon platform={platform} className="size-4" />
                {label}
              </a>
            );
          })}
        </div>
      )}
    </BlockCard>
  );
}
