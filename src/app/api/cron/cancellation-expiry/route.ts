import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/actions/notification";

// GET /api/cron/cancellation-expiry
// Markeer PENDING annuleringsverzoeken die over hun 7-dagen-deadline zijn als
// EXPIRED. Geen reactie van wederpartij = verkoper blijft leveringsplichtig.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  const expired = await prisma.cancellationRequest.findMany({
    where: {
      status: "PENDING",
      expiresAt: { lt: now },
    },
    include: {
      shippingBundle: { select: { orderNumber: true } },
    },
  });

  let processed = 0;
  for (const r of expired) {
    await prisma.cancellationRequest.update({
      where: { id: r.id },
      data: { status: "EXPIRED" },
    });

    await createNotification(
      r.proposedById,
      "NEW_MESSAGE",
      "Annuleringsverzoek verlopen",
      `Je annuleringsverzoek voor bestelling ${r.shippingBundle.orderNumber} is verlopen omdat de wederpartij niet heeft gereageerd. De bestelling staat nog open.`,
      "/dashboard/aankopen"
    );

    processed++;
  }

  return NextResponse.json({ processed, total: expired.length });
}
