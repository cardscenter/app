import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getVerificationStatus } from "@/actions/verification";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { VerificationForm } from "@/components/dashboard/verification-form";
import { AddressVerificationForm } from "@/components/dashboard/address-verification-form";
import { DashboardPageHeader } from "@/components/dashboard/ui/page-header";
import { DashboardSection } from "@/components/dashboard/ui/section";
import { StatusBadge } from "@/components/dashboard/ui/status-badge";
import { CheckCircle2, Clock, XCircle, Landmark, MapPin, IdCard } from "lucide-react";
import { Link } from "@/i18n/navigation";

import { Callout } from "@/components/dashboard/ui/callout";
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
    <div className="space-y-6">
      <DashboardPageHeader
        title={t("title")}
        subtitle="Verifieer je account om vertrouwen te wekken bij andere gebruikers. Drie types verificatie staan los van elkaar — je kunt er één, twee of alle drie behalen."
      />

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
          <div className="dash-card p-5 text-sm">
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
  const badge =
    statusValue === "APPROVED" ? (
      <StatusBadge tone="success" icon={CheckCircle2}>Geverifieerd</StatusBadge>
    ) : statusValue === "PENDING" ? (
      <StatusBadge tone="info" icon={Clock}>In behandeling</StatusBadge>
    ) : statusValue === "REJECTED" ? (
      <StatusBadge tone="danger" icon={XCircle}>Afgewezen</StatusBadge>
    ) : (
      <StatusBadge tone="neutral">Niet geverifieerd</StatusBadge>
    );

  return (
    <DashboardSection
      icon={icon}
      title={title}
      description={subtitle}
      action={badge}
      contentClassName="space-y-3"
    >
      {statusValue === "APPROVED" && (
        <Callout tone="green" icon={CheckCircle2} title={approvedLabel}>
          <p>{approvedDescription}</p>
          {reviewedAt && <p className="mt-1 text-xs opacity-75">Goedgekeurd op {new Date(reviewedAt).toLocaleDateString("nl-NL")}</p>}
        </Callout>
      )}

      {statusValue === "PENDING" && (
        <Callout tone="blue" icon={Clock} title={pendingLabel}>
          <p>{pendingDescription}</p>
          {submittedAt && <p className="mt-1 text-xs opacity-75">Ingediend op {new Date(submittedAt).toLocaleDateString("nl-NL")}</p>}
        </Callout>
      )}

      {statusValue === "REJECTED" && (
        <>
          <Callout tone="pink" icon={XCircle} title={rejectedLabel}>
            {rejectReason && <p>Reden: {rejectReason}</p>}
          </Callout>
          {children}
        </>
      )}

      {statusValue === "NONE" && children}
    </DashboardSection>
  );
}
