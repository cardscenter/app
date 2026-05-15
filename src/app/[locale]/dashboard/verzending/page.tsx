import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { AddressForm } from "@/components/dashboard/address-form";
import { ShippingMethodsManager } from "@/components/dashboard/shipping-methods-manager";
import { SellingScopeToggle } from "@/components/dashboard/selling-scope-toggle";
import { getSellerShippingMethods } from "@/actions/shipping-method";
import { normalizeSellingScope } from "@/lib/shipping/static-methods";
import { getCarriersForCountry } from "@/lib/shipping/carriers";
import { getEuNearNeighbors } from "@/lib/shipping/zones";

export default async function ShippingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/${locale}/login`);

  const t = await getTranslations("shipping");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id! },
  });
  if (!user) redirect(`/${locale}/login`);

  const enrichedMethods = await getSellerShippingMethods();
  const scope = normalizeSellingScope(user.sellingCountries);
  const availableCarriers = user.country ? getCarriersForCountry(user.country) : [];
  const neighbors = user.country ? getEuNearNeighbors(user.country) : [];

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

      {/* Selling scope section */}
      {user.country && (
        <section>
          <h2 className="text-lg font-semibold text-foreground">{t("sellingCountriesTitle")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("sellingCountriesDescription")}</p>
          <div className="mt-4">
            <SellingScopeToggle
              current={scope}
              originCountry={user.country}
              neighbors={neighbors}
            />
          </div>
        </section>
      )}

      {/* Static shipping methods section */}
      <section>
        <h2 className="text-lg font-semibold text-foreground">{t("methodsTitle")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("staticIntro")}</p>
        <div className="mt-4">
          <ShippingMethodsManager
            methods={enrichedMethods}
            availableCarriers={availableCarriers}
            hasCountry={!!user.country}
            neighbors={neighbors}
            scope={scope}
          />
        </div>
      </section>
    </div>
  );
}
