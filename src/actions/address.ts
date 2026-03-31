"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { addressSchema } from "@/lib/validations/address";

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

  await prisma.user.update({
    where: { id: session.user.id },
    data: result.data,
  });

  return { success: true };
}
