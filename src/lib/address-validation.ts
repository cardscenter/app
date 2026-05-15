import { prisma } from "@/lib/prisma";

export async function hasValidShippingAddress(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      street: true,
      houseNumber: true,
      postalCode: true,
      city: true,
      country: true,
    },
  });
  if (!user) return false;
  return Boolean(
    user.street?.trim() &&
      user.houseNumber?.trim() &&
      user.postalCode?.trim() &&
      user.city?.trim() &&
      user.country?.trim(),
  );
}
