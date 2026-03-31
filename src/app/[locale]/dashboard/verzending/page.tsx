import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { AddressForm } from "@/components/dashboard/address-form";
import { ShippingMethodsManager } from "@/components/dashboard/shipping-methods-manager";

export default async function ShippingPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const t = await getTranslations("shipping");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id! },
  });
  if (!user) redirect("/login");

  const methods = await prisma.sellerShippingMethod.findMany({
    where: { sellerId: user.id },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="space-y-8">
      {/* Address section */}
      <section>
        <h2 className="text-lg font-semibold text-foreground">{t("addressTitle")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("addressDescription")}</p>
        <div className="mt-4 glass rounded-2xl p-5">
          <AddressForm user={user} />
        </div>
      </section>

      {/* Shipping methods section */}
      <section>
        <h2 className="text-lg font-semibold text-foreground">{t("methodsTitle")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("methodsDescription")}</p>
        <div className="mt-4">
          <ShippingMethodsManager methods={methods} />
        </div>
      </section>
    </div>
  );
}
