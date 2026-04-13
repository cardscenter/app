"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function toggleCardWatchlist(cardId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };
  const userId = session.user.id;

  const existing = await prisma.cardWatchlist.findUnique({
    where: { userId_cardId: { userId, cardId } },
  });

  if (existing) {
    await prisma.cardWatchlist.delete({ where: { id: existing.id } });
    revalidatePath(`/dashboard/volglijst`);
    return { watching: false };
  }

  // Validate card exists before creating
  const card = await prisma.card.findUnique({
    where: { id: cardId },
    select: { id: true },
  });
  if (!card) return { error: "Kaart niet gevonden" };

  await prisma.cardWatchlist.create({ data: { userId, cardId } });
  revalidatePath(`/dashboard/volglijst`);
  return { watching: true };
}
