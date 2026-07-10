import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageContainer } from "@/components/layout/page-container";
import { MultiStepEventForm } from "@/components/events/multi-step-event-form";
import { eventToFormState } from "@/lib/events/event-to-form";

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/${locale}/login`);
  }

  const [event, user] = await Promise.all([
    prisma.event.findUnique({ where: { id } }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { accountType: true, emailVerifiedAt: true },
    }),
  ]);

  if (!event || event.organizerId !== session.user.id) notFound();
  if (event.status === "ENDED" || event.status === "DELETED") {
    redirect(`/${locale}/dashboard/evenementen`);
  }

  return (
    <PageContainer width="wide" className="py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Evenement bewerken</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pas de gegevens van &ldquo;{event.title}&rdquo; aan. Wijzigingen zijn direct zichtbaar
          zodra je opslaat.
        </p>
      </div>
      <MultiStepEventForm
        mode="edit"
        eventId={event.id}
        initialForm={eventToFormState(event)}
        accountType={user?.accountType ?? "FREE"}
        emailVerified={!!user?.emailVerifiedAt}
      />
    </PageContainer>
  );
}
