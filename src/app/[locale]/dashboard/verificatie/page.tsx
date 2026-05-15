import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getVerificationStatus } from "@/actions/verification";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { VerificationForm } from "@/components/dashboard/verification-form";
import { AddressVerificationForm } from "@/components/dashboard/address-verification-form";
import { CheckCircle2, Clock, XCircle, Landmark, MapPin, IdCard } from "lucide-react";
import { Link } from "@/i18n/navigation";

type Status = "NONE" | "PENDING" | "APPROVED" | "REJECTED";

export default async function VerificationPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect(`/${locale}/login`);
  const t = await getTranslations("verification");

  const status = await getVerificationStatus();
  if (!status) return null;

  // IBAN-info uit profiel — om te tonen of user al een IBAN heeft ingevuld.
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { iban: true },
  });
  const hasIban = !!user?.iban;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Verifieer je account om vertrouwen te wekken bij andere gebruikers. Drie types verificatie staan
          los van elkaar — je kunt er één, twee of alle drie behalen.
        </p>
      </div>

      {/* ID — gate voor bids ≥ €2000, en algemene trust-signal */}
      <Section
        icon={<IdCard className="h-5 w-5" />}
        title="Identiteits-verificatie"
        subtitle="Vereist voor biedingen vanaf €2000. Upload een paspoort, ID-kaart of rijbewijs."
        statusValue={status.status as Status}
        rejectReason={status.rejectReason}
        submittedAt={status.submittedAt}
        reviewedAt={status.reviewedAt}
        approvedLabel="ID geverifieerd"
        approvedDescription="Je kunt zonder limiet bieden en kopen."
        rejectedLabel="Verificatie afgewezen"
        pendingLabel={t("pending")}
        pendingDescription={t("pendingDescription")}
      >
        <VerificationForm />
      </Section>

      {/* IBAN — auto via admin's bank-confirm */}
      <Section
        icon={<Landmark className="h-5 w-5" />}
        title="Rekeningnummer-verificatie"
        subtitle="Wordt automatisch geverifieerd als je een storting doet vanaf het IBAN dat je op je profiel hebt ingevuld."
        statusValue={status.isIbanVerified ? "APPROVED" : "NONE"}
        rejectReason={null}
        submittedAt={null}
        reviewedAt={null}
        approvedLabel="Rekeningnummer geverifieerd"
        approvedDescription="Het IBAN-trust-badge is zichtbaar op je profiel."
        rejectedLabel=""
        pendingLabel=""
        pendingDescription=""
      >
        {!status.isIbanVerified && (
          <div className="rounded-2xl border border-border bg-card p-6 text-sm">
            {!hasIban ? (
              <>
                <p className="text-foreground">
                  Vul eerst je IBAN in op je profiel onder &quot;Bankgegevens&quot;.
                </p>
                <Link
                  href="/dashboard/profiel"
                  className="mt-2 inline-block text-xs font-medium text-primary underline hover:no-underline"
                >
                  Naar profiel →
                </Link>
              </>
            ) : (
              <p className="text-muted-foreground">
                Je IBAN staat ingevuld. Doe een saldostorting via de standaard bank-overschrijving en gebruik
                je{" "}
                <Link href="/dashboard/saldo" className="text-primary underline hover:no-underline">
                  bank-reference
                </Link>
                . Zodra de admin de storting bevestigt en het rekeningnummer overeenkomt, wordt je IBAN
                automatisch geverifieerd.
              </p>
            )}
          </div>
        )}
      </Section>

      {/* Adres — adres-document upload + admin review */}
      <Section
        icon={<MapPin className="h-5 w-5" />}
        title="Adres-verificatie"
        subtitle="Upload een officieel document (belastingdienst, energie-rekening, bankafschrift of gemeentebrief) waarop je naam én adres staan."
        statusValue={status.addressStatus as Status}
        rejectReason={status.addressRejectReason}
        submittedAt={status.addressSubmittedAt}
        reviewedAt={status.addressReviewedAt}
        approvedLabel="Adres geverifieerd"
        approvedDescription="Het adres-trust-badge is zichtbaar op je profiel."
        rejectedLabel="Adres-verificatie afgewezen"
        pendingLabel="In behandeling"
        pendingDescription="Een admin controleert je document."
      >
        <AddressVerificationForm />
      </Section>
    </div>
  );
}

function Section({
  icon,
  title,
  subtitle,
  statusValue,
  rejectReason,
  submittedAt,
  reviewedAt,
  approvedLabel,
  approvedDescription,
  rejectedLabel,
  pendingLabel,
  pendingDescription,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  statusValue: Status;
  rejectReason: string | null;
  submittedAt: Date | string | null;
  reviewedAt: Date | string | null;
  approvedLabel: string;
  approvedDescription: string;
  rejectedLabel: string;
  pendingLabel: string;
  pendingDescription: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <header className="flex items-center gap-2">
        <span className="text-muted-foreground">{icon}</span>
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      </header>
      <p className="text-xs text-muted-foreground">{subtitle}</p>

      {statusValue === "APPROVED" && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/10">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-green-600 dark:text-green-400" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-green-800 dark:text-green-300">{approvedLabel}</h3>
              <p className="text-xs text-green-600 dark:text-green-400">{approvedDescription}</p>
              {reviewedAt && (
                <p className="mt-1 text-xs text-green-500">
                  Goedgekeurd op {new Date(reviewedAt).toLocaleDateString("nl-NL")}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {statusValue === "PENDING" && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/10">
          <div className="flex items-start gap-3">
            <Clock className="mt-0.5 h-5 w-5 text-blue-600 dark:text-blue-400" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-300">{pendingLabel}</h3>
              <p className="text-xs text-blue-600 dark:text-blue-400">{pendingDescription}</p>
              {submittedAt && (
                <p className="mt-1 text-xs text-blue-500">
                  Ingediend op {new Date(submittedAt).toLocaleDateString("nl-NL")}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {statusValue === "REJECTED" && (
        <>
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/10">
            <div className="flex items-start gap-3">
              <XCircle className="mt-0.5 h-5 w-5 text-red-600 dark:text-red-400" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-red-800 dark:text-red-300">{rejectedLabel}</h3>
                {rejectReason && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">Reden: {rejectReason}</p>
                )}
              </div>
            </div>
          </div>
          {children}
        </>
      )}

      {statusValue === "NONE" && children}
    </section>
  );
}
