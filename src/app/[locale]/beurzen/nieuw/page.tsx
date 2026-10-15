import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageContainer } from "@/components/layout/page-container";
import { MultiStepEventForm } from "@/components/events/multi-step-event-form";
import { INITIAL_EVENT_FORM } from "@/components/events/event-form-types";
import { EVENT_TYPES, type EventType } from "@/lib/events/types";

export default async function NewEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/${locale}/login`);
  }

  // Type-preselect vanaf de tab-specifieke knop ("Beurs toevoegen" → ?type=BEURS).
  const rawType = typeof sp.type === "string" ? sp.type : "";
  const presetType = (EVENT_TYPES as readonly string[]).includes(rawType) ? (rawType as EventType) : null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { accountType: true, emailVerifiedAt: true },
  });

  return (
    <PageContainer width="wide" className="py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Evenement aanmaken</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Voeg een Pokémon-beurs of -evenement toe aan de kalender. Nieuwe inzendingen
          worden eerst gecontroleerd voordat ze publiek zichtbaar zijn.
        </p>
      </div>
      <MultiStepEventForm
        accountType={user?.accountType ?? "FREE"}
        emailVerified={!!user?.emailVerifiedAt}
        initialForm={presetType ? { ...INITIAL_EVENT_FORM, eventType: presetType } : undefined}
      />
    </PageContainer>
  );
}
