import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Building2, Clock } from "lucide-react";
import { ENTERPRISE_MIN_MONTHLY_REVENUE } from "@/lib/subscription-tiers";
import { EnterpriseRequestForm } from "@/components/subscription/enterprise-request-form";
import { Link } from "@/i18n/navigation";

export default async function EnterpriseAanvraagPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect(`/${locale}/login`);

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { accountType: true, displayName: true },
  });
  if (!user) return null;

  // Reeds Enterprise/Admin: laat alleen een melding zien
  const alreadyEnterprise = user.accountType === "ENTERPRISE" || user.accountType === "ADMIN";

  // Check pending request voor deze user
  const pending = await prisma.enterpriseRequest.findFirst({
    where: { userId: session.user.id, status: "PENDING" },
    select: { id: true, shopName: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-4">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-violet-500/10 p-3">
          <Building2 className="h-6 w-6 text-violet-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Enterprise aanvragen</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Voor handelaren met €{ENTERPRISE_MIN_MONTHLY_REVENUE.toLocaleString("nl-NL")}+ verkoop per maand.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
        <h2 className="mb-3 text-base font-semibold text-foreground">Wat krijg je?</h2>
        <ul className="space-y-2 text-sm text-foreground">
          <li>0% verkoopcommissie — alleen het vaste maandbedrag</li>
          <li>Onbeperkt veilingen, advertenties en claimsales</li>
          <li>Onbeperkte gratis homepage-spotlights</li>
          <li>Eigen winkel-URL + custom verkopersprofiel</li>
          <li>Persoonlijke account-manager + voorrang-support</li>
          <li>Vroege toegang tot nieuwe features</li>
        </ul>
        <p className="mt-4 text-xs text-muted-foreground">
          Standaardtarief €749/maand. Custom prijs is bespreekbaar op basis van je volume en use-case.
        </p>
      </div>

      {alreadyEnterprise ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm text-emerald-700 dark:text-emerald-400">
          Je hebt al toegang tot Enterprise.{" "}
          <Link href="/dashboard/abonnement" className="underline">
            Terug naar abonnement
          </Link>
        </div>
      ) : pending ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-700 dark:text-amber-400">
          <div className="flex items-start gap-2">
            <Clock className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <div>
              <p className="font-medium">Aanvraag in behandeling</p>
              <p className="mt-1">
                Je aanvraag voor &laquo;{pending.shopName}&raquo; van{" "}
                {pending.createdAt.toLocaleDateString("nl-NL")} wordt beoordeeld door het team. We nemen meestal binnen
                3 werkdagen contact op.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <EnterpriseRequestForm />
      )}
    </div>
  );
}
