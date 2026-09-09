import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ChevronRight, LayoutTemplate } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { hasFeature } from "@/lib/subscription-tiers";
import { getLevelByKey } from "@/lib/seller-levels";
import { isUserBlocked } from "@/actions/block-report";
import { getSellerProfileData } from "@/lib/seller-profile-data";
import { resolveFeaturedItems } from "@/lib/shop-featured";
import { getBuyerLocation } from "@/lib/shipping/filter";
import { Link } from "@/i18n/navigation";
import { PageContainer } from "@/components/layout/page-container";
import { SellerProfileHeader } from "@/components/seller/seller-profile-header";
import { SellerStatRow } from "@/components/seller/seller-stat-row";
import { ShopBlocks } from "@/components/shop/shop-blocks";
import { EmptyState } from "@/components/dashboard/ui/empty-state";
import { buttonVariants } from "@/components/ui/button-variants";

/**
 * /winkel/<slug> — de winkelpagina (Fase 45): het "aangepaste verkopersprofiel"
 * voor tiers met `features.customProfile`. Zelfde header + stat-rij als
 * /verkoper/[id], plus banner, slogan en de eigen blokken van de eigenaar.
 * Slug blijft bewaard bij downgrade; de route geeft dan notFound.
 */
async function loadOwner(slug: string) {
  return prisma.user.findUnique({
    where: { shopSlug: slug.toLowerCase() },
    select: { id: true, accountType: true, displayName: true, companyName: true, accountKind: true, shopTagline: true, shopPublished: true },
  });
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const owner = await loadOwner(slug);
  if (!owner || !hasFeature(owner.accountType, "customProfile")) return {};
  const name = owner.accountKind === "BUSINESS" && owner.companyName ? owner.companyName : owner.displayName;
  return {
    title: `${name} — winkel — Cards Center`,
    description: owner.shopTagline ?? undefined,
  };
}

export default async function ShopPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const owner = await loadOwner(slug);
  if (!owner || !hasFeature(owner.accountType, "customProfile")) notFound();

  const session = await auth();
  const viewerId = session?.user?.id ?? null;
  const isOwner = viewerId === owner.id;
  if (!owner.shopPublished && !isOwner) notFound();

  const t = await getTranslations("sellerProfile");
  const profile = await getSellerProfileData(owner.id, viewerId);
  if (!profile) notFound();

  const isLoggedIn = !!viewerId;
  const initiallyBlocked = !isOwner && isLoggedIn ? await isUserBlocked(owner.id) : false;
  const [resolved, buyer] = await Promise.all([
    resolveFeaturedItems(profile.user.shopBlocks, owner.id),
    getBuyerLocation(),
  ]);
  const levelBanner = profile.user.profileBanner ? getLevelByKey(profile.user.profileBanner) : undefined;
  const title = profile.user.accountKind === "BUSINESS" && profile.user.companyName ? profile.user.companyName : profile.user.displayName;

  return (
    <PageContainer width="default" className="py-8">
      <nav className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground" aria-label="Breadcrumb">
        <span>{t("breadcrumbSellers")}</span>
        <ChevronRight className="size-3.5" />
        <Link href={`/verkoper/${owner.id}`} className="hover:text-foreground">
          {profile.user.displayName}
        </Link>
        <ChevronRight className="size-3.5" />
        <span className="font-medium text-foreground">{t("shop")}</span>
      </nav>

      <div className="space-y-6">
        {/* Banner */}
        <div className="relative aspect-[3/1] w-full overflow-hidden rounded-xl bg-muted sm:aspect-[5/1]">
          {profile.user.shopBannerUrl ? (
            <Image src={profile.user.shopBannerUrl} alt={title} fill className="object-cover" sizes="(min-width: 1440px) 1440px, 100vw" priority unoptimized />
          ) : (
            <div className={`size-full bg-gradient-to-br ${levelBanner?.gradient ?? "from-slate-500 to-slate-700"}`}>
              <div className="flex size-full items-center justify-center text-5xl opacity-30 select-none">{levelBanner?.icon ?? "🏪"}</div>
            </div>
          )}
        </div>

        <SellerProfileHeader
          profile={profile}
          isOwner={isOwner}
          viewerLoggedIn={isLoggedIn}
          initiallyBlocked={initiallyBlocked}
          variant="shop"
          locale={locale}
        />

        <SellerStatRow profile={profile} />

        {profile.user.shopBlocks.length > 0 ? (
          <ShopBlocks blocks={profile.user.shopBlocks} resolved={resolved} locale={locale} buyer={buyer} />
        ) : (
          <EmptyState
            icon={LayoutTemplate}
            title={t("shopEmptyTitle")}
            description={isOwner ? t("shopEmptyOwner") : t("shopEmptyVisitor")}
            action={
              isOwner ? (
                <Link href="/dashboard/winkel" className={buttonVariants({ size: "sm" })}>
                  {t("editShop")}
                </Link>
              ) : undefined
            }
            compact
          />
        )}

        <div className="text-center">
          <Link href={`/verkoper/${owner.id}`} className="text-sm font-medium text-primary hover:underline">
            {t("viewFullProfile")}
          </Link>
        </div>
      </div>
    </PageContainer>
  );
}
