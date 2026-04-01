import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { MultiStepAuctionForm } from "@/components/auction/multi-step-auction-form";

export default async function NewAuctionPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const t = await getTranslations("auction");

  // Get user balance and account type for upsells
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { balance: true, reservedBalance: true, accountType: true },
  });

  // Get seller's shipping methods
  const shippingMethods = await prisma.sellerShippingMethod.findMany({
    where: { sellerId: session.user.id, isActive: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-foreground">
        {t("createTitle")}
      </h1>
      <div className="mt-8">
        <MultiStepAuctionForm
          shippingMethods={shippingMethods}
          userBalance={(user?.balance ?? 0) - (user?.reservedBalance ?? 0)}
          accountType={user?.accountType ?? "FREE"}
        />
      </div>
    </div>
  );
}
