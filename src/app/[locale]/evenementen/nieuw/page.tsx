import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageContainer } from "@/components/layout/page-container";
import { MultiStepEventForm } from "@/components/events/multi-step-event-form";

export default async function NewEventPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/${locale}/login`);
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { accountType: true },
  });

  return (
    <PageContainer width="default" className="py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Evenement aanmaken</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Voeg een Pokémon-beurs of -evenement toe aan de kalender. Nieuwe inzendingen
          worden eerst gecontroleerd voordat ze publiek zichtbaar zijn.
        </p>
      </div>
      <MultiStepEventForm accountType={user?.accountType ?? "FREE"} />
    </PageContainer>
  );
}
