import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { ProfileForm } from "@/components/dashboard/profile-form";
import { PasswordChangeForm } from "@/components/dashboard/password-change-form";
import { AddressForm } from "@/components/dashboard/address-form";
import { BankDetailsForm } from "@/components/dashboard/bank-details-form";
import { RunnerUpSettings } from "@/components/dashboard/runner-up-settings";
import { ShopSlugForm } from "@/components/dashboard/shop-slug-form";
import { BidConfirmationToggle } from "@/components/dashboard/bid-confirmation-toggle";
import { SellingScopeToggle } from "@/components/dashboard/selling-scope-toggle";
import { normalizeSellingScope } from "@/lib/shipping/static-methods";
import { getEuNearNeighbors } from "@/lib/shipping/zones";
import { SessionProvider } from "next-auth/react";
import { Link } from "@/i18n/navigation";
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
  Truck,
  Landmark,
  MapPin,
  User as UserIcon,
  Settings,
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
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">{t("profile")}</h1>
        <Link
          href={`/verkoper/${user.id}`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:border-foreground/30"
        >
          <ExternalLink className="size-3.5" />
          {tp("viewPublicProfile")}
        </Link>
      </div>

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
      <Section
        icon={<UserIcon className="size-5" />}
        title={tp("editProfile")}
        description="Hoe andere gebruikers jou zien op het platform."
      >
        <div className="max-w-lg">
          <SessionProvider>
            <ProfileForm user={user} />
          </SessionProvider>
        </div>
      </Section>

      {/* SECTIE 2 — Account & Login */}
      <Section
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
        </div>
      </Section>

      {/* SECTIE 3 — Adresgegevens (synced met /verzending) */}
      <Section
        icon={<MapPin className="size-5" />}
        title="Adresgegevens"
        description="Je adres wordt gedeeld met verkopers na aankoop. Maximaal eens per 30 dagen wijzigbaar."
      >
        <AddressForm user={user} />
      </Section>

      {/* SECTIE 4 — Bedrijfsgegevens (alleen voor BUSINESS-accounts) */}
      {isBusiness && (
        <Section
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
        </Section>
      )}

      {/* SECTIE 5 — Verzendgebied */}
      {user.country && (
        <Section
          icon={<Truck className="size-5" />}
          title="Verzendgebied"
          description="Naar welke landen verzend je. Kopers buiten je verzendgebied zien je items niet."
        >
          <SellingScopeToggle
            current={normalizeSellingScope(user.sellingCountries)}
            originCountry={user.country}
            neighbors={getEuNearNeighbors(user.country)}
          />
        </Section>
      )}

      {/* SECTIE 6 — Bankgegevens */}
      <Section
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
      </Section>

      {/* SECTIE 6b — Eigen winkel-URL (Unlimited+/Enterprise/Admin) */}
      {(user.accountType === "UNLIMITED" || user.accountType === "ENTERPRISE" || user.accountType === "ADMIN") && (
        <Section
          icon={<Sparkles className="size-5" />}
          title="Eigen winkel-URL"
          description="Een persoonlijke link naar je winkel-pagina. Inbegrepen bij Unlimited en Enterprise."
        >
          <div className="max-w-lg">
            <ShopSlugForm currentSlug={user.shopSlug} />
          </div>
        </Section>
      )}

      {/* SECTIE 7 — Voorkeuren (runner-up + bid-bevestiging) */}
      <Section
        icon={<Settings className="size-5" />}
        title="Voorkeuren"
        description="Instellingen voor automatische processen en bevestigings-modals."
      >
        <div className="max-w-lg space-y-5">
          <RunnerUpSettings current={user.maxRunnerUpAttempts} />
          <div className="border-t border-border pt-4">
            <BidConfirmationToggle currentValue={user.skipBidConfirmation} />
          </div>
        </div>
      </Section>

      {/* SECTIE 8 — Personalisatie hint (banner is nu in /customization) */}
      <Section
        icon={<Sparkles className="size-5" />}
        title="Personalisatie"
        description="Banner, emblem en achtergrond voor je publieke profiel."
      >
        <Link
          href="/customization"
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          <Sparkles className="size-4 text-amber-500" />
          Open personalisatie
        </Link>
      </Section>

      {/* SECTIE 9 — Geschiedenis */}
      {user.usernameHistory.length > 0 && (
        <Section
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
        </Section>
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

function Section({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
      <div className="border-b border-border bg-muted/30 px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{icon}</span>
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
        </div>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="p-5">{children}</div>
    </section>
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
