import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { checkClaimsaleLimit } from "@/lib/account-limits";
import { MultiStepClaimsaleForm } from "@/components/claimsale/multi-step-claimsale-form";
import { PageContainer } from "@/components/layout/page-container";
import { getSellerShippingMethods } from "@/actions/shipping-method";

export default async function NewClaimsalePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect(`/${locale}/login`);

  const t = await getTranslations("claimsale");
  const limit = await checkClaimsaleLimit(session.user.id);

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      balance: true,
      reservedBalance: true,
      accountType: true,
      freeUpsellsRemaining: true,
    },
  });

  const shippingMethods = await getSellerShippingMethods();

  return (
    <PageContainer width="default" className="py-8">
      <h1 className="text-2xl font-bold text-foreground">{t("createTitle")}</h1>
      <div className="mt-8">
        <MultiStepClaimsaleForm
          maxItems={limit.maxItems}
          shippingMethods={shippingMethods}
          userBalance={(user?.balance ?? 0) - (user?.reservedBalance ?? 0)}
          accountType={user?.accountType ?? "FREE"}
          freeUpsellsRemaining={user?.freeUpsellsRemaining ?? 0}
        />
      </div>
    </PageContainer>
  );
}
