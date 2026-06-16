import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Plus, CalendarDays } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { MyEventRow } from "@/components/events/my-event-row";

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
    select: { id: true, title: true, city: true, status: true, startTime: true, rejectionReason: true },
  });

  const rows = events.map((e) => ({
    id: e.id,
    title: e.title,
    city: e.city,
    status: e.status,
    startTime: e.startTime.toISOString(),
    rejectionReason: e.rejectionReason,
  }));

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Mijn evenementen</h1>
          <p className="mt-1 text-sm text-muted-foreground">Beheer de evenementen die je hebt aangemaakt.</p>
        </div>
        <Link
          href="/evenementen/nieuw"
          className="inline-flex items-center gap-2 self-start rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" /> Nieuw evenement
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="mt-6 flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-card/50 py-16 text-center">
          <CalendarDays className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Je hebt nog geen evenementen aangemaakt.</p>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {rows.map((e) => (
            <MyEventRow key={e.id} event={e} />
          ))}
        </div>
      )}
    </div>
  );
}
