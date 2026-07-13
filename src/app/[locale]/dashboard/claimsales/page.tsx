import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { redirect } from "next/navigation";
import { OfferTabs } from "@/components/dashboard/cluster-tabs";
import { EmptyState } from "@/components/dashboard/ui/empty-state";
import { StatusBadge, type StatusTone } from "@/components/dashboard/ui/status-badge";
import { buttonVariants } from "@/components/ui/button-variants";
import { Tag } from "lucide-react";

const CLAIMSALE_STATUS_TONE: Record<string, StatusTone> = {
  LIVE: "success",
  SCHEDULED: "info",
  DRAFT: "warning",
};

export default async function MyClaimsalesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect(`/${locale}/login`);
  const t = await getTranslations("dashboard");
  const tc = await getTranslations("claimsale");

  const claimsales = await prisma.claimsale.findMany({
    where: { sellerId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { items: true } },
      items: { where: { status: "SOLD" }, select: { id: true } },
    },
  });

  return (
    <div className="space-y-6">
      <OfferTabs
        userId={session.user.id}
        action={
          <Link href="/claimsales/nieuw" className={buttonVariants()}>
            + {tc("createTitle")}
          </Link>
        }
      />

      {claimsales.length === 0 ? (
        <EmptyState icon={Tag} title={t("noActiveClaimsales")} />
      ) : (
        <div className="space-y-3">
          {claimsales.map((cs) => (
            <Link
              key={cs.id}
              href={`/claimsales/${cs.id}`}
              className="block rounded-2xl border border-border bg-card p-4 shadow-card transition-shadow hover:shadow-card-hover"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-foreground">{cs.title}</h3>
                <StatusBadge tone={CLAIMSALE_STATUS_TONE[cs.status] ?? "neutral"}>
                  {cs.status}
                </StatusBadge>
              </div>
              <div className="mt-2 flex gap-4 text-sm text-muted-foreground">
                <span>{cs.items.length}/{cs._count.items} verkocht</span>
                <span>Verzending: €{cs.shippingCost.toFixed(2)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
