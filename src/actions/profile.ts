"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { saveUploadedFile } from "@/lib/upload";
import { z } from "zod";

const profileSchema = z.object({
  displayName: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_-]+$/),
  bio: z.string().max(500).optional(),
  defaultShippingCost: z.coerce.number().min(0),
});

export async function updateProfile(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const result = profileSchema.safeParse({
    displayName: formData.get("displayName"),
    bio: formData.get("bio") || undefined,
    defaultShippingCost: formData.get("defaultShippingCost"),
  });

  if (!result.success) {
    return { error: result.error.issues[0].message };
  }

  const { displayName, bio } = result.data;

  // Check uniqueness if name changed
  const existing = await prisma.user.findUnique({ where: { displayName } });
  if (existing && existing.id !== session.user.id) {
    return { error: "Deze gebruikersnaam is al in gebruik" };
  }

  // Handle avatar upload
  let avatarUrl: string | undefined;
  const removeAvatar = formData.get("removeAvatar") === "true";

  if (removeAvatar) {
    avatarUrl = "";
  } else {
    const avatarFile = formData.get("avatarFile") as File | null;
    if (avatarFile && avatarFile.size > 0) {
      try {
        avatarUrl = await saveUploadedFile(avatarFile);
      } catch {
        return { error: "Profielfoto uploaden mislukt. Maximaal 5MB (JPG, PNG, WebP, GIF)." };
      }
    }
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      displayName,
      bio: bio ?? null,
      ...(avatarUrl !== undefined && { avatarUrl: avatarUrl || null }),
    },
  });

  return { success: true };
}
