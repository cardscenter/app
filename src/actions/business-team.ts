"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireNotSuspended } from "@/lib/suspension";
import { getBlockedUserIds } from "@/lib/blocking";
import { createNotification } from "@/actions/notification";
import { findUserByNameInsensitive } from "@/lib/username-policy-server";
import { getFullName, getProfileTitle } from "@/lib/user-name";
import { revalidatePath } from "next/cache";
import { MAX_BUSINESS_MEMBERS } from "@/lib/business-team-config";

/**
 * Bedrijfsteam (profiel-redesign sept 2026).
 *
 * Model: het BUSINESS-account ís de bedrijfspagina en daarmee de eigenaar
 * (het is zijn login, aangemaakt via registratie-type "bedrijf" of
 * `convertToBusinessAccount`). Medewerkers zijn gewone persoonlijke accounts
 * die de eigenaar op gebruikersnaam uitnodigt; na acceptatie staan ze in het
 * Team-blok op de bedrijfspagina en toont hun eigen profiel "Werkt bij …".
 * Bewust géén inlogrechten op het bedrijfsaccount — dat is een aparte
 * rollen-/rechtenlaag die hier niet hoort.
 */

async function requireBusinessOwner() {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" as const };
  const susp = await requireNotSuspended(session.user.id);
  if ("error" in susp) return { error: susp.error };
  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, accountKind: true, companyName: true, displayName: true, firstName: true, lastName: true },
  });
  if (!me || me.accountKind !== "BUSINESS") {
    return { error: "Alleen bedrijfsaccounts kunnen een team beheren" as const };
  }
  return { me };
}

/** Eigenaar nodigt een gebruiker uit op gebruikersnaam (+ optionele functie). */
export async function inviteBusinessMember(username: string, title?: string) {
  const owner = await requireBusinessOwner();
  if ("error" in owner) return { error: owner.error };
  const { me } = owner;

  const name = username.trim().replace(/^@/, "");
  if (!name) return { error: "Vul een gebruikersnaam in" };
  const target = await findUserByNameInsensitive(name);
  if (!target) return { error: "Geen gebruiker gevonden met deze gebruikersnaam" };
  if (target.id === me.id) return { error: "Je kunt jezelf niet uitnodigen" };

  const targetFull = await prisma.user.findUnique({
    where: { id: target.id },
    select: { accountKind: true },
  });
  if (targetFull?.accountKind === "BUSINESS") {
    return { error: "Een bedrijfsaccount kan geen medewerker zijn — nodig een persoonlijk account uit" };
  }

  const blocked = await getBlockedUserIds(me.id);
  if (blocked.has(target.id)) return { error: "Je kunt deze gebruiker niet uitnodigen" };

  const count = await prisma.businessMember.count({ where: { businessId: me.id } });
  if (count >= MAX_BUSINESS_MEMBERS) {
    return { error: `Maximaal ${MAX_BUSINESS_MEMBERS} teamleden` };
  }

  const cleanTitle = title?.trim().slice(0, 60) || null;
  const existing = await prisma.businessMember.findUnique({
    where: { businessId_userId: { businessId: me.id, userId: target.id } },
    select: { id: true, status: true },
  });
  if (existing?.status === "ACCEPTED") return { error: "Deze gebruiker zit al in je team" };
  if (existing?.status === "PENDING") return { error: "Deze gebruiker heeft al een openstaande uitnodiging" };

  await prisma.businessMember.create({
    data: { businessId: me.id, userId: target.id, title: cleanTitle, status: "PENDING" },
  });

  const companyTitle = getProfileTitle(me);
  await createNotification(
    target.id,
    "BUSINESS_INVITE",
    "Uitnodiging voor een bedrijfsteam",
    `${companyTitle} wil je toevoegen als teamlid${cleanTitle ? ` (${cleanTitle})` : ""}. Accepteer of wijs af op je profielpagina.`,
    "/dashboard/profiel#team",
  );

  revalidatePath("/dashboard/profiel");
  return { success: true };
}

/** Genodigde accepteert of wijst af. Afwijzen verwijdert de rij. */
export async function respondToBusinessInvite(memberId: string, accept: boolean) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const invite = await prisma.businessMember.findUnique({
    where: { id: memberId },
    select: {
      id: true,
      userId: true,
      businessId: true,
      status: true,
      business: { select: { displayName: true, companyName: true, accountKind: true, firstName: true, lastName: true } },
    },
  });
  if (!invite || invite.userId !== session.user.id) return { error: "Uitnodiging niet gevonden" };
  if (invite.status !== "PENDING") return { error: "Deze uitnodiging is al verwerkt" };

  if (!accept) {
    await prisma.businessMember.delete({ where: { id: memberId } });
    revalidatePath("/dashboard/profiel");
    return { success: true };
  }

  // Race-safe: alleen flippen als 'ie nog PENDING is.
  const updated = await prisma.businessMember.updateMany({
    where: { id: memberId, status: "PENDING" },
    data: { status: "ACCEPTED", respondedAt: new Date() },
  });
  if (updated.count === 0) return { error: "Deze uitnodiging is al verwerkt" };

  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { displayName: true, firstName: true, lastName: true },
  });
  if (me) {
    await createNotification(
      invite.businessId,
      "BUSINESS_INVITE_ACCEPTED",
      "Teamlid toegevoegd",
      `${getFullName(me)} (@${me.displayName}) heeft je uitnodiging geaccepteerd en staat nu in je team.`,
      `/spelers/${invite.businessId}`,
    );
  }

  revalidatePath("/dashboard/profiel");
  revalidatePath(`/spelers/${invite.businessId}`);
  return { success: true };
}

/** Eigenaar verwijdert een teamlid/uitnodiging, óf het lid verlaat zelf het team. */
export async function removeBusinessMember(memberId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const row = await prisma.businessMember.findUnique({
    where: { id: memberId },
    select: { id: true, userId: true, businessId: true },
  });
  if (!row) return { error: "Teamlid niet gevonden" };
  const isOwner = row.businessId === session.user.id;
  const isSelf = row.userId === session.user.id;
  if (!isOwner && !isSelf) return { error: "Geen toegang" };

  await prisma.businessMember.delete({ where: { id: memberId } });

  revalidatePath("/dashboard/profiel");
  revalidatePath(`/spelers/${row.businessId}`);
  return { success: true };
}

/** Eigenaar past de functie-omschrijving van een teamlid aan. */
export async function updateBusinessMemberTitle(memberId: string, title: string) {
  const owner = await requireBusinessOwner();
  if ("error" in owner) return { error: owner.error };

  const updated = await prisma.businessMember.updateMany({
    where: { id: memberId, businessId: owner.me.id },
    data: { title: title.trim().slice(0, 60) || null },
  });
  if (updated.count === 0) return { error: "Teamlid niet gevonden" };

  revalidatePath("/dashboard/profiel");
  revalidatePath(`/spelers/${owner.me.id}`);
  return { success: true };
}
