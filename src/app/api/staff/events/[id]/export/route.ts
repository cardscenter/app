import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/roles-server";
import { parseAgeDivisions, divisionLabel, REGISTRATION_STATUS_LABEL, type RegistrationStatus } from "@/lib/shop-events/config";
import { parsePlayerIds } from "@/lib/games";
import { formatEventDate, formatEventTime } from "@/lib/shop-events/format";

export const runtime = "nodejs";

function csvCell(v: string | number | null | undefined): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * CSV-deelnemerslijst (staff + admin): naam, e-mail, spelers-ID, divisie,
 * status, betaald, ingecheckt. Puntkomma-gescheiden (Excel NL) met BOM.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireStaff();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const event = await prisma.shopEvent.findUnique({
    where: { id },
    include: {
      type: { select: { ageDivisions: true } },
      registrations: {
        where: { status: { in: ["RESERVED", "CONFIRMED", "WAITLIST", "OFFERED", "CHECKED_IN", "NO_SHOW", "CANCELLED", "REFUNDED"] } },
        orderBy: [{ status: "asc" }, { createdAt: "asc" }],
        include: {
          user: { select: { displayName: true, firstName: true, lastName: true, email: true, playerIds: true, guardianPhone: true } },
          payment: { select: { status: true, amount: true, paidAt: true } },
        },
      },
    },
  });
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const rules = parseAgeDivisions(event.type.ageDivisions);
  const gameKey = event.game ?? "";
  const header = ["Naam", "Gebruikersnaam", "E-mail", "Spelers-ID", "Divisie", "Status", "Betaald", "Bedrag", "Ingecheckt", "Noodcontact", "Ticketcode", "Ingeschreven op"];
  const rows = event.registrations.map((r) => {
    const fullName = [r.user.firstName, r.user.lastName].filter(Boolean).join(" ");
    const playerIds = parsePlayerIds(r.user.playerIds, gameKey ? [gameKey] : undefined);
    return [
      fullName || r.user.displayName,
      r.user.displayName,
      r.user.email,
      gameKey ? (playerIds[gameKey] ?? "") : Object.values(playerIds).join(" / "),
      divisionLabel(r.divisionKey, rules) ?? "",
      REGISTRATION_STATUS_LABEL[r.status as RegistrationStatus] ?? r.status,
      r.payment?.status === "PAID" || (r.status === "CONFIRMED" && r.amount === 0) ? "ja" : r.status === "CONFIRMED" ? "balie" : "nee",
      r.amount.toFixed(2).replace(".", ","),
      r.checkedInAt ? `${formatEventDate(r.checkedInAt)} ${formatEventTime(r.checkedInAt)}` : "",
      r.user.guardianPhone ?? "",
      r.ticketCode,
      `${formatEventDate(r.createdAt)} ${formatEventTime(r.createdAt)}`,
    ]
      .map(csvCell)
      .join(";");
  });
  const csv = "﻿" + [header.map(csvCell).join(";"), ...rows].join("\r\n") + "\r\n";
  const safeTitle = event.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 40);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="deelnemers-${safeTitle}-${formatEventDate(event.startsAt).replace(/\s+/g, "-")}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
