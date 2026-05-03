"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireNotSuspended } from "@/lib/suspension";
import { releaseEscrow } from "@/actions/wallet";
import { createNotification } from "@/actions/notification";
import {
  proposePickupSchema,
  confirmPickupSchema,
} from "@/lib/validations/pickup";
import {
  PICKUP_CODE_MAX_ATTEMPTS,
  PICKUP_LOCKOUT_HOURS,
  generatePickupCode,
} from "@/lib/pickup-config";

// Beide partijen kunnen een ophaalmoment voorstellen voor een PICKUP-bundle.
// Voor PLATFORM-bundles: bundle.status moet PAID zijn. Voor EXTERNAL-bundles:
// bundle.status mag PENDING zijn (geen escrow-betaling). Eén schedule per
// bundle (PickupSchedule.shippingBundleId @unique) — bestaande wordt
// overschreven (RESCHEDULED-pad).
export async function proposePickup(input: {
  shippingBundleId: string;
  proposedFor: string | Date;
  windowStart: string;
  windowEnd: string;
}) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const susp = await requireNotSuspended(session.user.id);
  if ("error" in susp) return { error: susp.error };

  const parsed = proposePickupSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const data = parsed.data;

  const bundle = await prisma.shippingBundle.findUnique({
    where: { id: data.shippingBundleId },
    include: { pickupSchedule: true, bundleProposal: { select: { conversationId: true } } },
  });
  if (!bundle) return { error: "Bestelling niet gevonden" };

  const isBuyer = bundle.buyerId === session.user.id;
  const isSeller = bundle.sellerId === session.user.id;
  if (!isBuyer && !isSeller) return { error: "Niet geautoriseerd" };

  // Bundle.deliveryMethod is de snapshot van wat koper koos bij koop/accept.
  // Werkt voor zowel single-listing (PICKUP_PLATFORM/EXTERNAL via buyListing),
  // stocked-pickup (geen listingId), als bundle-offer (deliveryChoice=PICKUP_*).
  if (bundle.deliveryMethod !== "PICKUP") {
    return { error: "Deze bestelling is geen ophaal-bestelling" };
  }

  // Status-eisen: PLATFORM-bundle moet PAID zijn, EXTERNAL mag PENDING.
  const validStatus =
    (bundle.paymentMode === "PLATFORM" && bundle.status === "PAID") ||
    (bundle.paymentMode === "EXTERNAL" && (bundle.status === "PENDING" || bundle.status === "SCHEDULED"));
  if (!validStatus) {
    return { error: "Bestelling staat niet in een staat waar een ophaalmoment mogelijk is" };
  }

  // Schedule maken of updaten. Bij elke nieuwe propose wordt de pickupCode
  // opnieuw gegenereerd én attempts/lockout gereset, zodat een nieuwe afspraak
  // een schone leien heeft.
  const code = generatePickupCode();

  let scheduleId: string;
  if (bundle.pickupSchedule) {
    await prisma.pickupSchedule.update({
      where: { id: bundle.pickupSchedule.id },
      data: {
        proposedById: session.user.id,
        proposedFor: data.proposedFor,
        windowStart: data.windowStart,
        windowEnd: data.windowEnd,
        status: "PROPOSED",
        pickupCode: code,
        pickupCodeAttempts: 0,
        pickupLockedUntil: null,
        respondedAt: null,
        reminderSentAt: null,
      },
    });
    scheduleId = bundle.pickupSchedule.id;
  } else {
    const created = await prisma.pickupSchedule.create({
      data: {
        shippingBundleId: bundle.id,
        proposedById: session.user.id,
        proposedFor: data.proposedFor,
        windowStart: data.windowStart,
        windowEnd: data.windowEnd,
        status: "PROPOSED",
        pickupCode: code,
      },
    });
    scheduleId = created.id;
  }

  // Bundle terug naar PENDING als hij in SCHEDULED stond — re-onderhandeling
  // van het moment via een nieuw voorstel.
  if (bundle.status === "SCHEDULED") {
    await prisma.shippingBundle.updateMany({
      where: { id: bundle.id, status: "SCHEDULED" },
      data: { status: bundle.paymentMode === "PLATFORM" ? "PAID" : "PENDING" },
    });
  }

  // Chat-bericht in de gekoppelde conversation, als die er is. Toon "om X"
  // voor exact moment (windowStart === windowEnd) en "tussen X en Y" voor span.
  const conversationId = bundle.bundleProposal?.conversationId;
  if (conversationId) {
    const dateStr = new Date(data.proposedFor).toLocaleDateString("nl-NL");
    const isExact = data.windowStart === data.windowEnd;
    const timeStr = isExact
      ? `om ${data.windowStart}`
      : `tussen ${data.windowStart} en ${data.windowEnd}`;
    await prisma.message.create({
      data: {
        conversationId,
        senderId: session.user.id,
        body: `Ophaalmoment voorgesteld: ${dateStr} ${timeStr}.`,
        pickupScheduleId: scheduleId,
      },
    });
  }

  const otherUserId = isBuyer ? bundle.sellerId : bundle.buyerId;
  await createNotification(
    otherUserId,
    "NEW_MESSAGE",
    "Ophaalmoment voorgesteld",
    `Een nieuw ophaalmoment is voorgesteld voor bestelling ${bundle.orderNumber}.`,
    conversationId ? `/nl/berichten/${conversationId}` : "/dashboard/aankopen"
  );

  return { success: true, scheduleId };
}

// Tegenpartij van proposer accepteert/weigert het ophaalmoment.
// Bij ACCEPT: schedule.status=ACCEPTED, bundle PAID/PENDING → SCHEDULED.
export async function respondToPickup(scheduleId: string, action: "ACCEPT" | "REJECT") {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const schedule = await prisma.pickupSchedule.findUnique({
    where: { id: scheduleId },
    include: { shippingBundle: { include: { bundleProposal: { select: { conversationId: true } } } } },
  });
  if (!schedule) return { error: "Ophaalmoment niet gevonden" };
  if (schedule.status !== "PROPOSED") return { error: "Dit ophaalmoment is al beantwoord" };
  if (schedule.proposedById === session.user.id) return { error: "Je kunt je eigen voorstel niet accepteren" };

  const bundle = schedule.shippingBundle;
  const isBuyer = bundle.buyerId === session.user.id;
  const isSeller = bundle.sellerId === session.user.id;
  if (!isBuyer && !isSeller) return { error: "Niet geautoriseerd" };

  if (action === "REJECT") {
    await prisma.pickupSchedule.updateMany({
      where: { id: scheduleId, status: "PROPOSED" },
      data: { status: "REJECTED", respondedAt: new Date() },
    });

    if (bundle.bundleProposal?.conversationId) {
      await prisma.message.create({
        data: {
          conversationId: bundle.bundleProposal.conversationId,
          senderId: session.user.id,
          body: "Ophaalmoment afgewezen — stel een ander moment voor.",
          pickupScheduleId: scheduleId,
        },
      });
    }

    await createNotification(
      schedule.proposedById,
      "NEW_MESSAGE",
      "Ophaalmoment afgewezen",
      "De wederpartij heeft je ophaalvoorstel afgewezen.",
      bundle.bundleProposal?.conversationId
        ? `/nl/berichten/${bundle.bundleProposal.conversationId}`
        : "/dashboard/aankopen"
    );

    return { success: true };
  }

  // ACCEPT — atomic flip schedule + bundle
  const result = await prisma.$transaction(async (tx) => {
    const flipSched = await tx.pickupSchedule.updateMany({
      where: { id: scheduleId, status: "PROPOSED" },
      data: { status: "ACCEPTED", respondedAt: new Date() },
    });
    if (flipSched.count === 0) throw new Error("Status is gewijzigd");

    const fromStatus = bundle.paymentMode === "PLATFORM" ? "PAID" : "PENDING";
    await tx.shippingBundle.updateMany({
      where: { id: bundle.id, status: fromStatus },
      data: { status: "SCHEDULED" },
    });
    return { ok: true };
  });
  if (!result.ok) return { error: "Status is gewijzigd" };

  if (bundle.bundleProposal?.conversationId) {
    await prisma.message.create({
      data: {
        conversationId: bundle.bundleProposal.conversationId,
        senderId: session.user.id,
        body: "Ophaalmoment bevestigd. De koper ziet de ophaalcode in zijn aankopen.",
        pickupScheduleId: scheduleId,
      },
    });
  }

  await createNotification(
    schedule.proposedById,
    "NEW_MESSAGE",
    "Ophaalmoment bevestigd",
    "Je ophaalvoorstel is geaccepteerd.",
    bundle.bundleProposal?.conversationId
      ? `/nl/berichten/${bundle.bundleProposal.conversationId}`
      : "/dashboard/aankopen"
  );

  return { success: true };
}

// Seller voert de 4-cijfer code in om de ophaal te bevestigen.
// Bij PLATFORM: escrow-release naar seller. Bij EXTERNAL: alleen state-flip,
// geen geldverschuiving.
export async function confirmPickup(input: { shippingBundleId: string; code: string }) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const parsed = confirmPickupSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const bundle = await prisma.shippingBundle.findUnique({
    where: { id: parsed.data.shippingBundleId },
    include: {
      pickupSchedule: true,
      bundleListings: { select: { listingId: true } },
    },
  });
  if (!bundle) return { error: "Bestelling niet gevonden" };
  if (bundle.sellerId !== session.user.id) return { error: "Alleen de verkoper kan de ophaal bevestigen" };
  if (bundle.status !== "SCHEDULED") return { error: "Bestelling staat niet in SCHEDULED-status" };
  if (!bundle.pickupSchedule) return { error: "Geen ophaal-afspraak gevonden" };

  const sched = bundle.pickupSchedule;
  if (sched.pickupLockedUntil && sched.pickupLockedUntil > new Date()) {
    const minutes = Math.ceil((sched.pickupLockedUntil.getTime() - Date.now()) / 60000);
    return { error: `Te veel verkeerde codes. Probeer het over ${minutes} minuten opnieuw.` };
  }

  const codeMatches = sched.pickupCode === parsed.data.code;
  if (!codeMatches) {
    const newAttempts = sched.pickupCodeAttempts + 1;
    const lockout =
      newAttempts >= PICKUP_CODE_MAX_ATTEMPTS
        ? new Date(Date.now() + PICKUP_LOCKOUT_HOURS * 60 * 60 * 1000)
        : null;

    await prisma.pickupSchedule.update({
      where: { id: sched.id },
      data: { pickupCodeAttempts: newAttempts, pickupLockedUntil: lockout },
    });
    const remaining = Math.max(0, PICKUP_CODE_MAX_ATTEMPTS - newAttempts);
    return { error: lockout
      ? `Te veel verkeerde codes. Probeer het over ${PICKUP_LOCKOUT_HOURS} uur opnieuw.`
      : `Verkeerde code. Nog ${remaining} pogingen.` };
  }

  // Code matcht — atomic flip + escrow-release voor PLATFORM
  const listingIds = bundle.bundleListings.map((bl) => bl.listingId);

  const result = await prisma.$transaction(async (tx) => {
    const flipBundle = await tx.shippingBundle.updateMany({
      where: { id: bundle.id, status: "SCHEDULED" },
      data: { status: "COMPLETED", deliveredAt: new Date() },
    });
    if (flipBundle.count === 0) throw new Error("Status is gewijzigd");

    await tx.pickupSchedule.update({
      where: { id: sched.id },
      data: { status: "COMPLETED", completedAt: new Date() },
    });

    // Multi-listing bundle: listings RESERVED → SOLD
    if (listingIds.length > 0) {
      await tx.listing.updateMany({
        where: { id: { in: listingIds }, status: "RESERVED" },
        data: { status: "SOLD", buyerId: bundle.buyerId },
      });
    } else if (bundle.listingId) {
      // Single-listing pickup-bundle (toekomstige uitbreiding via buyListing met EXTERNAL)
      await tx.listing.updateMany({
        where: { id: bundle.listingId, status: "RESERVED" },
        data: { status: "SOLD", buyerId: bundle.buyerId },
      });
    }

    return { ok: true };
  });
  if (!result.ok) return { error: "Status is gewijzigd" };

  // Escrow-release alleen voor PLATFORM-bundles
  if (bundle.paymentMode === "PLATFORM") {
    try {
      await releaseEscrow(bundle.sellerId, bundle.totalCost, `Ophaal voltooid: ${bundle.orderNumber}`, bundle.id);
    } catch (e) {
      // Best-effort log; bundle is al COMPLETED. Manual release via admin als nodig.
      console.error("Escrow-release na pickup-confirm failed:", e);
    }
  }

  await createNotification(
    bundle.buyerId,
    "ORDER_PAID",
    "Ophaal bevestigd",
    `Bestelling ${bundle.orderNumber} is afgehandeld. Bedankt!`,
    "/dashboard/aankopen"
  );

  return { success: true };
}

// Fase 27.42: koper-confirm voor EXTERNAL pickup. Geen code nodig — er staat
// geen geld op het spel via platform, dus de extra security-stap is overkill.
// Koper klikt "Bevestig ophaal" in /aankopen → bundle COMPLETED, listings
// RESERVED→SOLD. Symmetrisch met confirmDelivery voor SHIP-bundles.
// Anti-self-inflation: alleen koper kan bevestigen, seller niet — voorkomt
// dat sellers eigen sales fakes om level-tier te boosten.
export async function confirmExternalPickup(shippingBundleId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const bundle = await prisma.shippingBundle.findUnique({
    where: { id: shippingBundleId },
    include: {
      pickupSchedule: { select: { id: true } },
      bundleListings: { select: { listingId: true } },
    },
  });
  if (!bundle) return { error: "Bestelling niet gevonden" };
  if (bundle.buyerId !== session.user.id) {
    return { error: "Alleen de koper kan ophalen bevestigen" };
  }
  if (bundle.paymentMode !== "EXTERNAL") {
    return { error: "Deze bestelling vereist code-confirm door de verkoper" };
  }
  if (bundle.status !== "PENDING" && bundle.status !== "SCHEDULED") {
    return { error: "Bestelling kan niet meer bevestigd worden in deze status" };
  }

  const listingIds = bundle.bundleListings.map((bl) => bl.listingId);

  const result = await prisma.$transaction(async (tx) => {
    const flipped = await tx.shippingBundle.updateMany({
      where: {
        id: bundle.id,
        paymentMode: "EXTERNAL",
        status: { in: ["PENDING", "SCHEDULED"] },
      },
      data: { status: "COMPLETED", deliveredAt: new Date() },
    });
    if (flipped.count === 0) throw new Error("Status is gewijzigd");

    if (bundle.pickupSchedule) {
      await tx.pickupSchedule.update({
        where: { id: bundle.pickupSchedule.id },
        data: { status: "COMPLETED", completedAt: new Date() },
      });
    }

    // Multi-listing bundle: listings RESERVED → SOLD
    if (listingIds.length > 0) {
      await tx.listing.updateMany({
        where: { id: { in: listingIds }, status: "RESERVED" },
        data: { status: "SOLD", buyerId: bundle.buyerId },
      });
    } else if (bundle.listingId) {
      // Single-listing pickup-bundle (via reserveListingForExternalPickup)
      await tx.listing.updateMany({
        where: { id: bundle.listingId, status: "RESERVED" },
        data: { status: "SOLD", buyerId: bundle.buyerId },
      });
    }

    // Stocked items (ListingCardItem) RESERVED → SOLD
    await tx.listingCardItem.updateMany({
      where: { shippingBundleId: bundle.id, status: "RESERVED" },
      data: { status: "SOLD", soldAt: new Date() },
    });

    // Stocked listing-status hercomputeren — als alle items weg, listing → SOLD
    if (!bundle.listingId && listingIds.length === 0) {
      const items = await tx.listingCardItem.findMany({
        where: { shippingBundleId: bundle.id },
        select: { listingId: true },
        distinct: ["listingId"],
      });
      for (const it of items) {
        const remaining = await tx.listingCardItem.count({
          where: { listingId: it.listingId, status: { in: ["AVAILABLE", "RESERVED"] } },
        });
        await tx.listing.update({
          where: { id: it.listingId },
          data: { status: remaining === 0 ? "SOLD" : "PARTIALLY_SOLD" },
        });
      }
    }

    return { ok: true };
  });
  if (!result.ok) return { error: "Status is gewijzigd" };

  await createNotification(
    bundle.sellerId,
    "ORDER_PAID",
    "Ophaal bevestigd",
    `Bestelling ${bundle.orderNumber} is bevestigd door de koper.`,
    "/dashboard/verkopen"
  );

  return { success: true };
}

// Beide partijen kunnen een EXTERNAL-bundle vroegtijdig annuleren (geen
// wederzijds-akkoord nodig, want er staat geen geld op het spel).
export async function cancelExternalReservation(shippingBundleId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const bundle = await prisma.shippingBundle.findUnique({
    where: { id: shippingBundleId },
    include: {
      bundleListings: { select: { listingId: true } },
      bundleProposal: { select: { id: true, conversationId: true } },
    },
  });
  if (!bundle) return { error: "Bestelling niet gevonden" };
  if (bundle.paymentMode !== "EXTERNAL") return { error: "Alleen ophaal-reserveringen kunnen zo geannuleerd worden" };
  const isBuyer = bundle.buyerId === session.user.id;
  const isSeller = bundle.sellerId === session.user.id;
  if (!isBuyer && !isSeller) return { error: "Niet geautoriseerd" };
  if (bundle.status !== "PENDING" && bundle.status !== "SCHEDULED") {
    return { error: "Bestelling is al afgehandeld" };
  }

  const listingIds = bundle.bundleListings.map((bl) => bl.listingId);

  await prisma.$transaction(async (tx) => {
    await tx.shippingBundle.updateMany({
      where: { id: bundle.id, paymentMode: "EXTERNAL" },
      data: { status: "CANCELLED" },
    });
    if (listingIds.length > 0) {
      await tx.listing.updateMany({
        where: { id: { in: listingIds }, status: "RESERVED" },
        data: { status: "ACTIVE", buyerId: null },
      });
    } else if (bundle.listingId) {
      await tx.listing.updateMany({
        where: { id: bundle.listingId, status: "RESERVED" },
        data: { status: "ACTIVE", buyerId: null },
      });
    }
    if (bundle.bundleProposal) {
      await tx.bundleProposal.update({
        where: { id: bundle.bundleProposal.id },
        data: { status: isBuyer ? "WITHDRAWN" : "REJECTED", paymentStatus: null },
      });
    }
  });

  if (bundle.bundleProposal?.conversationId) {
    await prisma.message.create({
      data: {
        conversationId: bundle.bundleProposal.conversationId,
        senderId: session.user.id,
        body: `Ophaal-reservering geannuleerd door ${isBuyer ? "koper" : "verkoper"}.`,
        bundleProposalId: bundle.bundleProposal.id,
      },
    });
  }

  await createNotification(
    isBuyer ? bundle.sellerId : bundle.buyerId,
    "NEW_MESSAGE",
    "Reservering geannuleerd",
    `De ophaal-reservering voor bestelling ${bundle.orderNumber} is geannuleerd. Advertenties staan weer actief.`,
    bundle.bundleProposal?.conversationId
      ? `/nl/berichten/${bundle.bundleProposal.conversationId}`
      : isBuyer ? "/dashboard/verkopen" : "/dashboard/aankopen"
  );

  return { success: true };
}

// Buyer leest de pickup-code voor een SCHEDULED bundle.
export async function getPickupCode(shippingBundleId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const bundle = await prisma.shippingBundle.findUnique({
    where: { id: shippingBundleId },
    include: { pickupSchedule: true },
  });
  if (!bundle) return { error: "Bestelling niet gevonden" };
  if (bundle.buyerId !== session.user.id) return { error: "Alleen de koper kan de code zien" };
  if (bundle.status !== "SCHEDULED" || !bundle.pickupSchedule) {
    return { error: "Geen actieve ophaal-afspraak" };
  }

  return { success: true, code: bundle.pickupSchedule.pickupCode };
}
