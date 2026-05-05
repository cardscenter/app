import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { MultiStepAuctionForm } from "@/components/auction/multi-step-auction-form";
import { PageContainer } from "@/components/layout/page-container";

export default async function NewAuctionPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const t = await getTranslations("auction");

  // Get user balance, account type and city (voor pickup-veilingen auto-fill)
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { balance: true, reservedBalance: true, accountType: true, city: true, freeUpsellsRemaining: true },
  });

  // Get seller's shipping methods
  const shippingMethods = await prisma.sellerShippingMethod.findMany({
    where: { sellerId: session.user.id, isActive: true },
    orderBy: { createdAt: "desc" },
  });

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
        />
      </div>
    </PageContainer>
  );
}
