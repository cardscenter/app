import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Globe, Building2, ExternalLink } from "lucide-react";
import { hasFeature } from "@/lib/subscription-tiers";
import { parseShopBlocks } from "@/lib/validations/shop";
import { DashboardPageHeader } from "@/components/dashboard/ui/page-header";
import { DashboardSection } from "@/components/dashboard/ui/section";
import { ShopSlugForm } from "@/components/dashboard/shop-slug-form";
import { ShopPageLocked } from "@/components/dashboard/shop/shop-page-locked";
import { BusinessConvertForm } from "@/components/dashboard/shop/business-convert-form";
import { ShopPageEditor } from "@/components/dashboard/shop/shop-page-editor";
import { buttonVariants } from "@/components/ui/button-variants";

/**
 * /dashboard/winkel — beheer van winkel-URL en winkelpagina (Fase 45).
 * Nav-item is altijd zichtbaar (zoals Statistieken); zonder de tier-feature
 * `customProfile` rendert de pagina een vergrendelde teaser.
 */
export default async function ShopDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect(`/${locale}/login`);

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      accountType: true,
      accountKind: true,
      companyName: true,
      cocNumber: true,
      vatNumber: true,
      shopSlug: true,
      shopBannerUrl: true,
      shopTagline: true,
      shopBlocks: true,
      shopPublished: true,
    },
  });
  if (!user) redirect(`/${locale}/login`);

  const unlocked = hasFeature(user.accountType, "customProfile");
  const isBusiness = user.accountKind === "BUSINESS";

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="Winkelpagina"
        subtitle="Je eigen winkel-URL met banner, slogan en blokken — het uitgebreide verkopersprofiel voor Unlimited en Enterprise."
        action={
          unlocked && user.shopSlug ? (
            <a href={`/${locale}/winkel/${user.shopSlug}`} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "outline" })}>
              <ExternalLink data-icon="inline-start" />
              Bekijk winkelpagina
            </a>
          ) : (
            <span className={buttonVariants({ variant: "outline" })} aria-disabled title="Stel eerst een winkel-URL in">
              <ExternalLink data-icon="inline-start" />
              Bekijk winkelpagina
            </span>
          )
        }
      />

      {!unlocked ? (
        <ShopPageLocked />
      ) : (
        <>
          <DashboardSection icon={<Globe className="size-5" />} title="Winkel-URL" description="Een persoonlijke link naar je winkelpagina. Bij downgrade blijft de URL bewaard maar werkt hij pas weer na een upgrade.">
            <div className="max-w-lg">
              <ShopSlugForm currentSlug={user.shopSlug} />
            </div>
          </DashboardSection>

          <DashboardSection
            icon={<Building2 className="size-5" />}
            title="Bedrijfspagina"
            description={
              isBusiness
                ? "Je winkelpagina toont bedrijfsnaam en KvK-/btw-gegevens en heeft de bedrijfsblokken (galerij, standplaats, openingstijden)."
                : "Als particulier houd je de editor eenvoudig: tekst, uitgelicht aanbod en links. Een bedrijf krijgt daarbovenop een fotogalerij en standplaats/openingstijden."
            }
          >
            {isBusiness ? (
              <dl className="grid max-w-lg grid-cols-1 gap-3 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Bedrijfsnaam</dt>
                  <dd className="mt-0.5 font-medium text-foreground">{user.companyName ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">KvK</dt>
                  <dd className="mt-0.5 font-medium text-foreground">{user.cocNumber ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Btw-id</dt>
                  <dd className="mt-0.5 font-medium text-foreground">{user.vatNumber ?? "—"}</dd>
                </div>
              </dl>
            ) : (
              <BusinessConvertForm />
            )}
          </DashboardSection>

          <ShopPageEditor
            initial={{
              bannerUrl: user.shopBannerUrl,
              tagline: user.shopTagline,
              published: user.shopPublished,
              blocks: parseShopBlocks(user.shopBlocks),
            }}
            isBusiness={isBusiness}
            hasSlug={!!user.shopSlug}
            shopSlug={user.shopSlug}
          />
        </>
      )}
    </div>
  );
}
