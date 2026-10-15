import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSiteUrl } from "@/lib/site-url";
import { PLATFORM } from "@/lib/platform-config";

export const runtime = "nodejs";

function icsDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function icsEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Agenda-export ("Zet in mijn agenda") voor één gepubliceerd winkel-event. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = await prisma.shopEvent.findUnique({
    where: { id },
    select: { id: true, status: true, title: true, description: true, startsAt: true, endsAt: true, updatedAt: true },
  });
  if (!event || event.status === "DRAFT") return NextResponse.json({ error: "Not found" }, { status: 404 });

  const siteUrl = getSiteUrl();
  const shop = PLATFORM.shop;
  const location = `${shop.name}, ${shop.street} ${shop.houseNumber}, ${shop.postalCode ? shop.postalCode + " " : ""}${shop.city}`;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Cards Center//Winkel-events//NL",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:shop-event-${event.id}@cards-center`,
    `DTSTAMP:${icsDate(event.updatedAt)}`,
    `DTSTART:${icsDate(event.startsAt)}`,
    `DTEND:${icsDate(event.endsAt)}`,
    `SUMMARY:${icsEscape(event.title)}`,
    `DESCRIPTION:${icsEscape((event.description ?? "").slice(0, 1000))}${event.description ? "\\n\\n" : ""}${siteUrl}/nl/evenementen/${event.id}`,
    `LOCATION:${icsEscape(location)}`,
    `URL:${siteUrl}/nl/evenementen/${event.id}`,
    `STATUS:${event.status === "CANCELLED" ? "CANCELLED" : "CONFIRMED"}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return new NextResponse(lines.join("\r\n") + "\r\n", {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="cards-center-${event.id}.ics"`,
      "Cache-Control": "public, max-age=300",
    },
  });
}
