import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { MultiStepListingForm } from "@/components/listing/multi-step-listing-form";

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

  // Get user balance and account type for upsells
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { balance: true, accountType: true },
  });

  // Get seller's shipping methods
  const shippingMethods = await prisma.sellerShippingMethod.findMany({
    where: { sellerId: session.user.id!, isActive: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-foreground mb-8">{t("createTitle")}</h1>
      <MultiStepListingForm
        seriesList={seriesList}
        userBalance={user?.balance ?? 0}
        userAccountType={user?.accountType ?? "FREE"}
        shippingMethods={shippingMethods}
      />
    </div>
  );
}
