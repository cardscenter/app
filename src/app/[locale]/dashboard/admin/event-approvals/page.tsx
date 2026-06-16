import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/admin";
import { AdminEventApprovalList } from "@/components/dashboard/admin-event-approval-list";

export default async function AdminEventApprovalsPage() {
  await requireAdminPage();

  const pendingEvents = await prisma.event.findMany({
    where: { status: "PENDING" },
    include: {
      organizer: {
        select: {
          id: true,
          displayName: true,
          email: true,
          createdAt: true,
          isVerified: true,
          isIbanVerified: true,
          isAddressVerified: true,
          isTrustedEventOrganizer: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const events = pendingEvents.map((e) => ({
    id: e.id,
    title: e.title,
    description: e.description,
    eventType: e.eventType,
    venueName: e.venueName,
    street: e.street,
    houseNumber: e.houseNumber,
    postalCode: e.postalCode,
    city: e.city,
    country: e.country,
    timezone: e.timezone,
    lat: e.lat,
    lng: e.lng,
    startTime: e.startTime.toISOString(),
    endTime: e.endTime.toISOString(),
    entryType: e.entryType,
    entryPrice: e.entryPrice,
    entryCurrency: e.entryCurrency,
    registrationUrl: e.registrationUrl,
    coverImage: e.coverImage,
    isOfficial: e.isOfficial,
    isSanctioned: e.isSanctioned,
    createdAt: e.createdAt.toISOString(),
    organizer: e.organizer,
  }));

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">Evenementen ter beoordeling</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Nieuwe evenementen wachten op goedkeuring voordat ze publiek zichtbaar worden.
        Markeer betrouwbare organisatoren als &ldquo;vertrouwd&rdquo; zodat hun toekomstige
        evenementen direct live gaan.
      </p>
      <div className="mt-6">
        <AdminEventApprovalList events={events} />
      </div>
    </div>
  );
}
