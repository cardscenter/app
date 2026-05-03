"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { addressSchema } from "@/lib/validations/address";
import { getAddressCooldownInfo, ADDRESS_COOLDOWN_DAYS } from "@/lib/address-cooldown";

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

  // Cooldown-guard: 30 dagen na vorige wijziging. Eerste keer is gratis
  // (lastAddressChange null). Server-side check is autoritair — UI knop kan
  // verborgen zijn maar we vertrouwen niet op de client.
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { lastAddressChange: true },
  });
  const cooldown = getAddressCooldownInfo(user?.lastAddressChange ?? null);
  if (!cooldown.canEdit) {
    return {
      error: `Je kunt je adres pas weer wijzigen over ${cooldown.daysRemaining} ${
        cooldown.daysRemaining === 1 ? "dag" : "dagen"
      } (${ADDRESS_COOLDOWN_DAYS}-dagen cooldown).`,
    };
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { ...result.data, lastAddressChange: new Date() },
  });

  return { success: true };
}
