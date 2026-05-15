import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { MultiStepAuctionForm } from "@/components/auction/multi-step-auction-form";
import { PageContainer } from "@/components/layout/page-container";
import { getSellerShippingMethods } from "@/actions/shipping-method";

export default async function NewAuctionPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect(`/${locale}/login`);

  const t = await getTranslations("auction");

  // Get user balance, account type and city (voor pickup-veilingen auto-fill).
  // `maxRunnerUpAttempts` propagating zodat de form de runner-up-toggle kan
  // verbergen (of locken) als de gebruiker globaal "uit" heeft gezet.
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      balance: true,
      reservedBalance: true,
      accountType: true,
      city: true,
      freeUpsellsRemaining: true,
      maxRunnerUpAttempts: true,
    },
  });

  // Get seller's shipping methods (Fase 33: enriched)
  const shippingMethods = await getSellerShippingMethods();

  return (
    <PageContainer width="default" className="py-8">
      <h1 className="text-2xl font-bold text-foreground">
        {t("createTitle")}
      </h1>
      <div className="mt-8">
        <MultiStepAuctionForm
          shippingMethods={shippingMethods}
          userBalance={(user?.balance ?? 0) - (user?.reservedBalance ?? 0)}
          accountType={user?.accountType ?? "FREE"}
          freeUpsellsRemaining={user?.freeUpsellsRemaining ?? 0}
          userCity={user?.city ?? null}
          maxRunnerUpAttempts={user?.maxRunnerUpAttempts ?? 2}
        />
      </div>
    </PageContainer>
  );
}
