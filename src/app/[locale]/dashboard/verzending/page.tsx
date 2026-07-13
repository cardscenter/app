import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ShippingMethodsManager } from "@/components/dashboard/shipping-methods-manager";
import { SellingScopeToggle } from "@/components/dashboard/selling-scope-toggle";
import { DashboardPageHeader } from "@/components/dashboard/ui/page-header";
import { DashboardSection } from "@/components/dashboard/ui/section";
import { getSellerShippingMethods } from "@/actions/shipping-method";
import { normalizeSellingScope } from "@/lib/shipping/static-methods";
import { getCarriersForCountry } from "@/lib/shipping/carriers";
import { getEuNearNeighbors } from "@/lib/shipping/zones";
import { Globe2, Truck } from "lucide-react";

export default async function ShippingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/${locale}/login`);

  const t = await getTranslations("shipping");
  const td = await getTranslations("dashboard");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id! },
  });
  if (!user) redirect(`/${locale}/login`);

  const enrichedMethods = await getSellerShippingMethods();
  const scope = normalizeSellingScope(user.sellingCountries);
  const availableCarriers = user.country ? getCarriersForCountry(user.country) : [];
  const neighbors = user.country ? getEuNearNeighbors(user.country) : [];

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title={td("myShipping")}
        subtitle="Je verzendgebied en verzendmethoden per zone."
      />

      {/* Adres leeft canoniek op /dashboard/profiel (Fase 44) — hier alleen
          een verwijzing zodat er geen twee formulieren naast elkaar bestaan. */}
      <p className="text-sm text-muted-foreground">
        Je verzendadres wijzig je op{" "}
        <Link href="/dashboard/profiel" className="font-medium text-primary hover:underline">
          je profiel
        </Link>
        .
      </p>

      {/* Selling scope section */}
      {user.country && (
        <DashboardSection
          icon={<Globe2 className="size-5" />}
          title={t("sellingCountriesTitle")}
          description={t("sellingCountriesDescription")}
        >
          <SellingScopeToggle
            current={scope}
            originCountry={user.country}
            neighbors={neighbors}
          />
        </DashboardSection>
      )}

      {/* Static shipping methods section */}
      <DashboardSection
        icon={<Truck className="size-5" />}
        title={t("methodsTitle")}
        description={t("staticIntro")}
        variant="plain"
      >
        <ShippingMethodsManager
          methods={enrichedMethods}
          availableCarriers={availableCarriers}
          hasCountry={!!user.country}
          originCountry={user.country ?? null}
          neighbors={neighbors}
          scope={scope}
        />
      </DashboardSection>
    </div>
  );
}
