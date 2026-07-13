import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { ProfileForm } from "@/components/dashboard/profile-form";
import { PasswordChangeForm } from "@/components/dashboard/password-change-form";
import { TwoFactorSettings } from "@/components/dashboard/two-factor-settings";
import { AddressForm } from "@/components/dashboard/address-form";
import { BankDetailsForm } from "@/components/dashboard/bank-details-form";
import { ShopSlugForm } from "@/components/dashboard/shop-slug-form";
import { DashboardPageHeader } from "@/components/dashboard/ui/page-header";
import { DashboardSection } from "@/components/dashboard/ui/section";
import { SessionProvider } from "next-auth/react";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import {
  ExternalLink,
  Shield,
  ShieldCheck,
  Calendar,
  Mail,
  CreditCard,
  Award,
  Building2,
  History,
  Sparkles,
  Landmark,
  MapPin,
  User as UserIcon,
  KeyRound,
} from "lucide-react";
import { getLevel } from "@/lib/seller-levels";
import { getSellerStats } from "@/actions/review";
import { VerifiedBadge } from "@/components/ui/verified-badge";
import { IBAN_COOLDOWN_DAYS } from "@/lib/validations/iban";
import type { ReactNode } from "react";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect(`/${locale}/login`);
  const t = await getTranslations("dashboard");
  const tp = await getTranslations("profile");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      usernameHistory: {
        orderBy: { changedAt: "desc" },
        take: 5,
      },
    },
  });
  if (!user) return null;

  const stats = await getSellerStats(user.id);
  const sellerLevel = stats ? getLevel(stats.xp) : null;

  const memberSince = user.createdAt.toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const tierLabels: Record<string, string> = {
    FREE: "Free",
    PRO: "Pro",
    UNLIMITED: "Unlimited",
    ADMIN: "Admin",
  };

  const isBusiness = user.accountKind === "BUSINESS";

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title={t("profile")}
        subtitle="Je identiteit, adres, beveiliging en bankgegevens."
        action={
          <Link href={`/verkoper/${user.id}`} className={buttonVariants({ variant: "outline" })}>
            <ExternalLink className="size-3.5" />
            {tp("viewPublicProfile")}
          </Link>
        }
      />

      {/* Account overview — 4 KPI-cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <OverviewCard icon={<Calendar className="size-4" />} label={tp("memberSince")}>
          <span className="text-sm font-semibold text-foreground">{memberSince}</span>
        </OverviewCard>
        <OverviewCard icon={<CreditCard className="size-4" />} label={tp("accountTier")}>
          <span className="text-sm font-semibold text-foreground">
            {tierLabels[user.accountType] ?? user.accountType}
          </span>
        </OverviewCard>
        <OverviewCard
          icon={
            user.isVerified ? (
              <ShieldCheck className="size-4 text-green-500" />
            ) : (
              <Shield className="size-4" />
            )
          }
          label={tp("verification")}
        >
          {user.isVerified ? (
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-green-600 dark:text-green-400">
              {tp("verified")} <VerifiedBadge size="sm" />
            </span>
          ) : (
            <Link
              href="/dashboard/verificatie"
              className="text-sm font-semibold text-primary hover:text-primary-hover transition-colors"
            >
              {tp("verifyNow")}
            </Link>
          )}
        </OverviewCard>
        <OverviewCard icon={<Award className="size-4" />} label={tp("sellerLevel")}>
          <span className="text-sm font-semibold text-foreground">
            {sellerLevel?.name ?? "Tin"}{" "}
            <span className="font-normal text-muted-foreground">
              ({stats?.xp ?? 0} XP)
            </span>
          </span>
        </OverviewCard>
      </div>

      {/* SECTIE 1 — Profielinformatie: avatar + displayName + bio */}
      <DashboardSection
        icon={<UserIcon className="size-5" />}
        title={tp("editProfile")}
        description="Hoe andere gebruikers jou zien op het platform."
      >
        <div className="max-w-lg">
          <SessionProvider>
            <ProfileForm user={user} />
          </SessionProvider>
        </div>
      </DashboardSection>

      {/* SECTIE 2 — Account & Login */}
      <DashboardSection
        icon={<KeyRound className="size-5" />}
        title="Account & Login"
        description="Inloggegevens en abonnement."
      >
        <div className="space-y-4">
          <ReadOnlyRow icon={<Mail className="size-4" />} label={tp("email")} value={user.email} />
          <ReadOnlyRow
            icon={<CreditCard className="size-4" />}
            label={tp("accountTier")}
            value={tierLabels[user.accountType] ?? user.accountType}
            action={
              <Link
                href="/dashboard/abonnement"
                className="text-sm font-medium text-primary hover:text-primary-hover transition-colors"
              >
                Beheren →
              </Link>
            }
          />
          <PasswordChangeForm />
          <TwoFactorSettings enabled={user.totpEnabled} />
        </div>
      </DashboardSection>

      {/* SECTIE 3 — Adresgegevens (synced met /verzending) */}
      <DashboardSection
        icon={<MapPin className="size-5" />}
        title="Adresgegevens"
        description="Je adres wordt gedeeld met verkopers na aankoop. Maximaal eens per 30 dagen wijzigbaar."
      >
        <AddressForm user={user} />
      </DashboardSection>

      {/* SECTIE 4 — Bedrijfsgegevens (alleen voor BUSINESS-accounts) */}
      {isBusiness && (
        <DashboardSection
          icon={<Building2 className="size-5" />}
          title="Bedrijfsgegevens"
          description="Officiële gegevens van je onderneming. Wijzigen via support."
        >
          <div className="space-y-4">
            <ReadOnlyRow
              icon={<Building2 className="size-4" />}
              label="Bedrijfsnaam"
              value={user.companyName ?? "—"}
            />
            <ReadOnlyRow
              icon={<Building2 className="size-4" />}
              label="BTW-nummer"
              value={user.vatNumber ?? "—"}
            />
            <ReadOnlyRow
              icon={<Building2 className="size-4" />}
              label="KVK-nummer"
              value={user.cocNumber ?? "—"}
            />
          </div>
        </DashboardSection>
      )}

      {/* SECTIE 6 — Bankgegevens */}
      <DashboardSection
        icon={<Landmark className="size-5" />}
        title="Bankgegevens"
        description="Voor uitbetalingen van je verkopen. Eerste keer gratis, daarna 30 dagen cooldown bij wijziging."
      >
        <div className="max-w-lg">
          <BankDetailsForm
            iban={user.iban}
            accountHolderName={user.accountHolderName}
            lastIbanChange={user.lastIbanChange?.toISOString() ?? null}
            cooldownDays={IBAN_COOLDOWN_DAYS}
          />
        </div>
      </DashboardSection>

      {/* SECTIE 6b — Eigen winkel-URL (Unlimited+/Enterprise/Admin) */}
      {(user.accountType === "UNLIMITED" || user.accountType === "ENTERPRISE" || user.accountType === "ADMIN") && (
        <DashboardSection
          icon={<Sparkles className="size-5" />}
          title="Eigen winkel-URL"
          description="Een persoonlijke link naar je winkel-pagina. Inbegrepen bij Unlimited en Enterprise."
        >
          <div className="max-w-lg">
            <ShopSlugForm currentSlug={user.shopSlug} />
          </div>
        </DashboardSection>
      )}

      {/* Voorkeuren (runner-up, bied-bevestiging, e-mail) leven sinds Fase 44
          op /dashboard/instellingen; personalisatie is tijdelijk op slot. */}

      {/* SECTIE 9 — Geschiedenis */}
      {user.usernameHistory.length > 0 && (
        <DashboardSection
          icon={<History className="size-5" />}
          title={tp("usernameHistory")}
          description="Vorige usernames blijven 90 dagen zichtbaar in zoekresultaten en op je publieke profiel."
        >
          <div className="space-y-2">
            {user.usernameHistory.map((h) => (
              <div
                key={h.id}
                className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm"
              >
                <span className="text-muted-foreground line-through">{h.oldName}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {new Date(h.changedAt).toLocaleDateString("nl-NL", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </div>
            ))}
          </div>
        </DashboardSection>
      )}
    </div>
  );
}

function OverviewCard({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-card">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function ReadOnlyRow({
  icon,
  label,
  value,
  action,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/20 px-3 py-2.5">
      <div className="flex min-w-0 items-center gap-3">
        <span className="text-muted-foreground">{icon}</span>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="truncate text-sm font-medium text-foreground">{value}</p>
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
