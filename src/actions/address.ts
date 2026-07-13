"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { addressSchema } from "@/lib/validations/address";
import { getAddressCooldownInfo, ADDRESS_COOLDOWN_DAYS } from "@/lib/address-cooldown";
import { setupStaticShippingMethods } from "@/actions/shipping-method";

export async function updateAddress(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const result = addressSchema.safeParse({
    street: formData.get("street"),
    houseNumber: formData.get("houseNumber"),
    postalCode: formData.get("postalCode"),
    city: formData.get("city"),
    country: formData.get("country"),
  });

  if (!result.success) {
    return { error: result.error.issues[0].message };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      lastAddressChange: true,
      street: true,
      houseNumber: true,
      postalCode: true,
      city: true,
      country: true,
    },
  });

  // Fase 43 — cooldown geldt alleen voor het WIJZIGEN van een compleet adres.
  // Een incompleet adres aanvullen (eerste invulling / onboarding-vangnet) is
  // geen fraudegevoelige wijziging en start ook geen cooldown, zodat een typo
  // direct te fixen is. Zelfde compleetheids-semantiek als
  // hasValidShippingAddress.
  const wasComplete = Boolean(
    user?.street?.trim() &&
      user?.houseNumber?.trim() &&
      user?.postalCode?.trim() &&
      user?.city?.trim() &&
      user?.country?.trim(),
  );

  if (wasComplete) {
    // Cooldown-guard: 30 dagen na vorige wijziging. Eerste wijziging is gratis
    // (lastAddressChange null). Server-side check is autoritair — UI knop kan
    // verborgen zijn maar we vertrouwen niet op de client.
    const cooldown = getAddressCooldownInfo(user?.lastAddressChange ?? null);
    if (!cooldown.canEdit) {
      return {
        error: `Je kunt je adres pas weer wijzigen over ${cooldown.daysRemaining} ${
          cooldown.daysRemaining === 1 ? "dag" : "dagen"
        } (${ADDRESS_COOLDOWN_DAYS}-dagen cooldown).`,
      };
    }
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      ...result.data,
      ...(wasComplete && { lastAddressChange: new Date() }),
    },
  });

  // Fase 43 — bij een landwijziging de statische verzend-slots hersyncen:
  // default-carrier en slot-set zijn origin-country-specifiek. Idempotent,
  // dus veilig; alleen aanroepen als het land daadwerkelijk wijzigt.
  if (user?.country !== result.data.country) {
    await setupStaticShippingMethods(session.user.id);
  }

  return { success: true };
}
