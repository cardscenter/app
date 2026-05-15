import { Gavel } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveRunnerUpOffersForUser } from "@/actions/auction";
import { RunnerUpOfferCard } from "@/components/auction/runner-up-offer-card";

export async function ActiveRunnerUpOffersSection() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const offers = await getActiveRunnerUpOffersForUser();
  if (offers.length === 0) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { balance: true, reservedBalance: true },
  });
  const availableBalance = Math.max(0, (user?.balance ?? 0) - (user?.reservedBalance ?? 0));

  return (
    <section className="mb-6">
      <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-foreground">
        <Gavel className="h-5 w-5" />
        Aanbiedingen om veiling over te nemen
      </h2>
      <div className="space-y-3">
        {offers.map((offer) => (
          <RunnerUpOfferCard key={offer.id} offer={offer} availableBalance={availableBalance} />
        ))}
      </div>
    </section>
  );
}
