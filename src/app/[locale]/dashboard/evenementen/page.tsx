import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Plus, CalendarDays } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { MyEventRow } from "@/components/events/my-event-row";
import { EventVendorRequestsPanel } from "@/components/events/event-vendor-requests-panel";
import { OfferTabs } from "@/components/dashboard/cluster-tabs";
import { EmptyState } from "@/components/dashboard/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";

export default async function MyEventsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect(`/${locale}/login`);

  const events = await prisma.event.findMany({
    where: { organizerId: session.user.id, status: { not: "DELETED" } },
    orderBy: { startTime: "asc" },
    select: {
      id: true, title: true, city: true, status: true, startTime: true, rejectionReason: true,
      vendorRequests: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true, status: true, message: true, createdAt: true,
          user: { select: { id: true, displayName: true, avatarUrl: true, companyName: true, city: true } },
        },
      },
    },
  });

  const rows = events.map((e) => ({
    id: e.id,
    title: e.title,
    city: e.city,
    status: e.status,
    startTime: e.startTime.toISOString(),
    rejectionReason: e.rejectionReason,
    vendorRequests: e.vendorRequests.map((r) => ({
      id: r.id,
      status: r.status,
      message: r.message,
      createdAt: r.createdAt.toISOString(),
      user: r.user,
    })),
  }));

  return (
    <div className="space-y-6">
      <OfferTabs
        userId={session.user.id}
        action={
          <Link href="/evenementen/nieuw" className={buttonVariants()}>
            <Plus className="h-4 w-4" /> Nieuw evenement
          </Link>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="Nog geen evenementen"
          description="Je hebt nog geen evenementen aangemaakt."
          action={
            <Link href="/evenementen/nieuw" className={buttonVariants({ size: "sm" })}>
              <Plus className="h-4 w-4" /> Nieuw evenement
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {rows.map((e) => (
            <div key={e.id}>
              <MyEventRow event={e} />
              {e.vendorRequests.length > 0 && <EventVendorRequestsPanel requests={e.vendorRequests} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
