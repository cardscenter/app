import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// ICS-tekstvelden: backslash, puntkomma, komma en newlines escapen (RFC 5545).
function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

// UTC-basic formaat: 20260712T090000Z (start/eindtijd staan al als UTC in de DB).
function toIcsUtc(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

/** Publieke agenda-export ("Zet in mijn agenda") voor één LIVE evenement. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const event = await prisma.event.findUnique({
    where: { id },
    select: {
      id: true, status: true, title: true, startTime: true, endTime: true,
      venueName: true, street: true, houseNumber: true, postalCode: true, city: true,
      updatedAt: true,
    },
  });
  if (!event || event.status !== "LIVE") {
    return NextResponse.json({ error: "Evenement niet gevonden" }, { status: 404 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const location = `${event.venueName}, ${event.street} ${event.houseNumber}, ${event.postalCode} ${event.city}`;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Cards Center//Evenementen//NL",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:event-${event.id}@cardscenter`,
    `DTSTAMP:${toIcsUtc(event.updatedAt)}`,
    `DTSTART:${toIcsUtc(event.startTime)}`,
    `DTEND:${toIcsUtc(event.endTime)}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
    `LOCATION:${escapeIcsText(location)}`,
    `URL:${siteUrl}/evenementen/${event.id}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return new NextResponse(lines.join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="evenement-${event.id}.ics"`,
      "Cache-Control": "public, max-age=300",
    },
  });
}
