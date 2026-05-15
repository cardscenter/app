import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { MultiStepListingForm } from "@/components/listing/multi-step-listing-form";
import { PageContainer } from "@/components/layout/page-container";
import { getSellerShippingMethods } from "@/actions/shipping-method";

export default async function NieuwListingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/${locale}/login`);

  const t = await getTranslations("listing");

  // Get Pokémon series with sets
  const pokemon = await prisma.category.findUnique({ where: { slug: "pokemon" } });
  const seriesList = pokemon
    ? await prisma.series.findMany({
        where: { categoryId: pokemon.id },
        include: { cardSets: true },
        orderBy: { name: "asc" },
      })
    : [];

  // Get user balance, account type, and city (for pickup-listings auto-fill)
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { balance: true, accountType: true, city: true, freeUpsellsRemaining: true },
  });

  // Get seller's shipping methods (Fase 33: enriched met basePrice/effectivePrice)
  const shippingMethods = await getSellerShippingMethods();

  return (
    <PageContainer width="default" className="py-8">
      <h1 className="text-2xl font-bold text-foreground mb-8">{t("createTitle")}</h1>
      <MultiStepListingForm
        seriesList={seriesList}
        userBalance={user?.balance ?? 0}
        userAccountType={user?.accountType ?? "FREE"}
        freeUpsellsRemaining={user?.freeUpsellsRemaining ?? 0}
        userCity={user?.city ?? null}
        shippingMethods={shippingMethods}
      />
    </PageContainer>
  );
}
