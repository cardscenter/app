import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { normalizeSellingScope } from "@/lib/shipping/static-methods";
import { getEuNearNeighbors } from "@/lib/shipping/zones";
import { WelcomeOnboarding } from "@/components/onboarding/welcome-onboarding";

/**
 * Onboarding-wizard (Fase 43) — landing na de klik op de verificatie-link.
 * Stateless: welke stappen getoond worden volgt uit de actuele user-data
 * (adres-vangnet alleen bij incompleet adres, 2FA-nudge alleen zonder TOTP).
 */
export default async function WelcomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/${locale}/login?callbackUrl=/welkom`);
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });
  if (!user) {
    redirect(`/${locale}/login?callbackUrl=/welkom`);
  }

  const addressComplete = Boolean(
    user.street?.trim() &&
      user.houseNumber?.trim() &&
      user.postalCode?.trim() &&
      user.city?.trim() &&
      user.country?.trim(),
  );
  const scope = normalizeSellingScope(user.sellingCountries);
  const neighbors = user.country ? getEuNearNeighbors(user.country) : [];

  return (
    <WelcomeOnboarding
      user={user}
      addressComplete={addressComplete}
      scope={scope}
      originCountry={user.country ?? null}
      neighbors={neighbors}
      totpEnabled={user.totpEnabled}
    />
  );
}
