import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { ArrowRight } from "lucide-react";
import Image from "next/image";
import { HeroEmailForm } from "@/components/home/hero-email-form";
import { PricingSection } from "@/components/home/pricing-section";
import { SearchBar } from "@/components/search/search-bar";

export default function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  return <HomePageContent params={params} />;
}

async function HomePageContent({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();

  const [activeAuctions, activeClaimsales, totalUsers] = await Promise.all([
    prisma.auction.count({ where: { status: "ACTIVE" } }),
    prisma.claimsale.count({ where: { status: "LIVE" } }),
    prisma.user.count(),
  ]);

  const recentAuctions = await prisma.auction.findMany({
    where: { status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    take: 4,
    include: {
      seller: { select: { displayName: true } },
    },
  });

  const recentClaimsales = await prisma.claimsale.findMany({
    where: { status: "LIVE" },
    orderBy: { publishedAt: "desc" },
    take: 4,
    include: {
      seller: { select: { displayName: true } },
      items: { where: { status: "AVAILABLE" }, select: { price: true } },
    },
  });

  return (
    <HomePageView
      isLoggedIn={!!session?.user}
      userName={session?.user?.name ?? ""}
      stats={{ activeAuctions, activeClaimsales, totalUsers }}
      recentAuctions={recentAuctions.map((a) => ({
        id: a.id,
        title: a.title,
        currentBid: a.currentBid,
        startingBid: a.startingBid,
        endTime: a.endTime.toISOString(),
        sellerName: a.seller.displayName,
        auctionType: a.auctionType,
      }))}
      recentClaimsales={recentClaimsales.map((c) => ({
        id: c.id,
        title: c.title,
        sellerName: c.seller.displayName,
        itemCount: c.items.length,
        priceRange: c.items.length > 0
          ? { min: Math.min(...c.items.map((i) => i.price)), max: Math.max(...c.items.map((i) => i.price)) }
          : null,
        shippingCost: c.shippingCost,
      }))}
    />
  );
}

function HomePageView({
  isLoggedIn,
  userName,
  stats,
  recentAuctions,
  recentClaimsales,
}: {
  isLoggedIn: boolean;
  userName: string;
  stats: { activeAuctions: number; activeClaimsales: number; totalUsers: number };
  recentAuctions: {
    id: string;
    title: string;
    currentBid: number | null;
    startingBid: number;
    endTime: string;
    sellerName: string;
    auctionType: string;
  }[];
  recentClaimsales: {
    id: string;
    title: string;
    sellerName: string;
    itemCount: number;
    priceRange: { min: number; max: number } | null;
    shippingCost: number;
  }[];
}) {
  const t = useTranslations("home");
  const tc = useTranslations("common");
  const ta = useTranslations("auction");

  return (
    <div className="flex flex-col">
      {/* Hero — different for logged-in vs visitor */}
      {isLoggedIn ? (
        <LoggedInHero userName={userName} />
      ) : (
        <MarketingHero stats={stats} />
      )}

      {/* Pricing — only for visitors */}
      {!isLoggedIn && <PricingSection />}

      {/* How It Works — only for visitors */}
      {!isLoggedIn && <HowItWorksSection />}

      {/* Recent Auctions */}
      <section className="py-16 bg-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-foreground">
              {t("recentAuctions")}
            </h2>
            <Link
              href="/veilingen"
              className="text-sm font-medium text-primary hover:text-primary-hover transition-colors"
            >
              {t("viewAll")} &rarr;
            </Link>
          </div>
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {recentAuctions.length === 0 ? (
              <EmptyCard message={tc("noResults")} />
            ) : (
              recentAuctions.map((auction) => (
                <Link
                  key={auction.id}
                  href={`/veilingen/${auction.id}`}
                  className="group glass rounded-2xl p-4 transition-all hover:shadow-md hover:scale-[1.02]"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <span className="rounded-full bg-primary-light px-2.5 py-0.5 text-xs font-medium text-primary">
                      {auction.auctionType === "SINGLE_CARD" ? ta("singleCard") : auction.auctionType === "COLLECTION" ? ta("collection") : ta("bulk")}
                    </span>
                    <CountdownBadge endTime={auction.endTime} />
                  </div>
                  <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2">
                    {auction.title}
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">{auction.sellerName}</p>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="text-lg font-bold text-foreground">
                      €{(auction.currentBid ?? auction.startingBid).toFixed(2)}
                    </span>
                    {auction.currentBid === null && (
                      <span className="text-xs text-muted-foreground">{ta("startingBid")}</span>
                    )}
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Recent Claimsales */}
      <section className="section-gradient-alt py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-foreground">
              {t("recentClaimsales")}
            </h2>
            <Link
              href="/claimsales"
              className="text-sm font-medium text-primary hover:text-primary-hover transition-colors"
            >
              {t("viewAll")} &rarr;
            </Link>
          </div>
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {recentClaimsales.length === 0 ? (
              <EmptyCard message={tc("noResults")} />
            ) : (
              recentClaimsales.map((cs) => (
                <Link
                  key={cs.id}
                  href={`/claimsales/${cs.id}`}
                  className="group glass rounded-2xl p-4 transition-all hover:shadow-md hover:scale-[1.02]"
                >
                  <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2">
                    {cs.title}
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">{cs.sellerName}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                      {cs.itemCount} {cs.itemCount === 1 ? "kaart" : "kaarten"}
                    </span>
                    {cs.priceRange && (
                      <span className="text-sm font-semibold text-foreground">
                        {cs.priceRange.min === cs.priceRange.max
                          ? `€${cs.priceRange.min.toFixed(2)}`
                          : `€${cs.priceRange.min.toFixed(2)} - €${cs.priceRange.max.toFixed(2)}`}
                      </span>
                    )}
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </section>

      {/* CTA Banner — only for visitors */}
      {!isLoggedIn && <CtaBanner />}

      {/* TCG Category */}
      <section className="section-gradient py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-2xl font-bold text-foreground">
            {t("supportedTcgs")}
          </h2>
          <div className="mt-8 flex justify-center">
            <TcgCard name="Pokémon" />
          </div>
        </div>
      </section>
    </div>
  );
}

/* ── Hero Sections ── */

function MarketingHero({ stats }: { stats: { activeAuctions: number; activeClaimsales: number; totalUsers: number } }) {
  const t = useTranslations("home");

  return (
    <section className="relative overflow-hidden">
      {/* Background image — full width */}
      <div className="absolute inset-0">
        <Image
          src="/images/hero-banner-pc-image.png"
          alt=""
          fill
          className="object-cover object-center"
          priority
        />
        {/* Overlay: strong on left for text readability, lighter on right */}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900/90 via-slate-900/75 to-slate-900/40" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-6 py-24 lg:py-28">
        <div className="max-w-xl">
          {/* Badge */}
          <Link
            href="/veilingen"
            className="inline-flex w-fit items-center gap-2 rounded-lg border border-white/20 bg-white/10 backdrop-blur-sm p-1 pr-3"
          >
            <span className="rounded-[calc(var(--radius)-0.25rem)] bg-primary px-2 py-1 text-xs font-medium text-white">
              {stats.activeAuctions} {t("activeAuctions").toLowerCase()}
            </span>
            <span className="text-sm text-white/80">{t("browseAuctions")}</span>
            <span className="block h-4 w-px bg-white/30" />
            <ArrowRight className="size-4 text-white/80" />
          </Link>

          <h1 className="mt-8 text-balance text-4xl font-bold text-white md:text-5xl xl:text-5xl">
            {t("heroTitle")}
          </h1>
          <p className="mt-6 text-lg text-white/80">
            {t("heroSubtitle")}
          </p>

          <div>
            {/* Email → Register form */}
            <HeroEmailForm />

            <ul className="list-inside list-disc space-y-2 text-sm text-white/70">
              <li>{t("featureSecure")}</li>
              <li>{t("featureAntiSnipe")}</li>
              <li>{t("featureFreeAccount")}</li>
            </ul>
          </div>

          {/* Stats */}
          <div className="mt-10 grid grid-cols-3 gap-4">
            <div>
              <p className="text-2xl font-bold text-white">{stats.activeAuctions}</p>
              <p className="text-xs text-white/60">{t("activeAuctions")}</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.activeClaimsales}</p>
              <p className="text-xs text-white/60">{t("activeClaimsales")}</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.totalUsers}</p>
              <p className="text-xs text-white/60">{t("totalUsers")}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function LoggedInHero({ userName }: { userName: string }) {
  const t = useTranslations("home");

  return (
    <section className="section-gradient border-b border-border py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
          {t("welcomeBack", { name: userName })}
        </h1>
        <p className="mt-2 text-muted-foreground">{t("quickActions")}</p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/veilingen/nieuw"
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
          >
            {t("createAuction")}
          </Link>
          <Link
            href="/claimsales/nieuw"
            className="rounded-lg border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            {t("createClaimsale")}
          </Link>
          <Link
            href="/dashboard"
            className="rounded-lg border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            {t("viewBalance")}
          </Link>
        </div>

        {/* Search bar */}
        <div className="mt-6">
          <SearchBar variant="hero" />
        </div>
      </div>
    </section>
  );
}

function HowItWorksSection() {
  const t = useTranslations("home");

  const steps = [
    { num: "1", title: t("step1Title"), desc: t("step1Desc") },
    { num: "2", title: t("step2Title"), desc: t("step2Desc") },
    { num: "3", title: t("step3Title"), desc: t("step3Desc") },
  ];

  return (
    <section className="section-gradient py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-center text-2xl font-bold text-foreground">
          {t("howItWorks")}
        </h2>
        <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-3">
          {steps.map((step) => (
            <div key={step.num} className="text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
                {step.num}
              </div>
              <h3 className="mt-4 text-lg font-semibold text-foreground">{step.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── CTA Banner ── */

function CtaBanner() {
  const t = useTranslations("home");

  return (
    <section className="bg-slate-900 py-12">
      <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
        <h2 className="text-2xl font-bold text-white sm:text-3xl">{t("ctaTitle")}</h2>
        <Link
          href="/register"
          className="mt-6 inline-block rounded-lg bg-primary px-8 py-3.5 text-sm font-semibold text-white shadow-lg transition-all hover:bg-primary-hover hover:shadow-xl"
        >
          {t("ctaButton")}
        </Link>
      </div>
    </section>
  );
}

/* ── Helper Components ── */

function CountdownBadge({ endTime }: { endTime: string }) {
  const end = new Date(endTime);
  const now = new Date();
  const diff = end.getTime() - now.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (diff <= 0) return <span className="text-xs text-muted-foreground">Afgelopen</span>;
  if (days > 0) return <span className="text-xs text-muted-foreground">{days}d</span>;
  if (hours > 0) return <span className="text-xs text-warning">{hours}u</span>;
  return <span className="text-xs font-medium text-error">{"<1u"}</span>;
}

function TcgCard({ name }: { name: string }) {
  return (
    <div className="glass flex items-center justify-center rounded-2xl p-8 transition-all hover:shadow-md hover:scale-[1.02]">
      <span className="text-xl font-bold text-foreground">{name}</span>
    </div>
  );
}

function EmptyCard({ message }: { message: string }) {
  return (
    <div className="col-span-full glass-subtle flex h-32 items-center justify-center rounded-2xl border-dashed">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

