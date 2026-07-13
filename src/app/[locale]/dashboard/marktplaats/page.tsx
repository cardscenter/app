import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Upload } from "lucide-react";
import { OfferTabs } from "@/components/dashboard/cluster-tabs";
import { EmptyState } from "@/components/dashboard/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { Store } from "lucide-react";
import { ListingCard } from "@/components/listing/listing-card";
import { ListingStatusBadge } from "@/components/listing/listing-status-badge";
import { hasFeature } from "@/lib/subscription-tiers";
import type { ListingStatus } from "@/types";

export default async function DashboardMarktplaatsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect(`/${locale}/login`);

  const t = await getTranslations("listing");

  const listings = await prisma.listing.findMany({
    where: { sellerId: session.user.id, status: { not: "DELETED" } },
    orderBy: { createdAt: "desc" },
    include: { seller: { select: { displayName: true } } },
  });

  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { accountType: true },
  });
  const canBulkUpload = hasFeature(me?.accountType ?? "FREE", "bulkUpload");

  const active          = listings.filter((l) => l.status === "ACTIVE");
  const partiallySold   = listings.filter((l) => l.status === "PARTIALLY_SOLD");
  const reserved        = listings.filter((l) => l.status === "RESERVED");
  const paused          = listings.filter((l) => l.status === "PAUSED");
  const sold            = listings.filter((l) => l.status === "SOLD");

  return (
    <div className="space-y-6">
      <OfferTabs
        userId={session.user.id}
        action={
          <>
            {canBulkUpload && (
              <Link href="/marktplaats/bulk-upload" className={buttonVariants({ variant: "outline" })}>
                <Upload className="h-4 w-4" />
                Bulk-upload
              </Link>
            )}
            <Link href="/marktplaats/nieuw" className={buttonVariants()}>
              + {t("createTitle")}
            </Link>
          </>
        }
      />

      <Section title={t("sections.active")} status="ACTIVE" items={active} locale={locale} emptyKey="noListings" />
      {partiallySold.length > 0 && <Section title={t("sections.partiallySold")} status="PARTIALLY_SOLD" items={partiallySold} locale={locale} emptyKey="" />}
      {reserved.length > 0 && <Section title={t("sections.reserved")} status="RESERVED" items={reserved} locale={locale} emptyKey="" />}
      {paused.length > 0 && <Section title={t("sections.paused")} status="PAUSED" items={paused} locale={locale} emptyKey="" />}
      {sold.length > 0 && <Section title={t("sections.sold")} status="SOLD" items={sold} locale={locale} emptyKey="" />}
    </div>
  );
}

interface SectionProps {
  title: string;
  status: ListingStatus;
  items: Array<{
    id: string;
    title: string;
    imageUrls: string;
    listingType?: string;
    cardName: string | null;
    condition: string | null;
    pricingType: string;
    price: number | null;
    shippingCost: number;
    freeShipping?: boolean;
    status?: string;
    seller: { displayName: string };
  }>;
  locale: string;
  emptyKey: string;
}

async function Section({ title, status, items, locale, emptyKey }: SectionProps) {
  const t = await getTranslations("listing");
  if (items.length === 0 && !emptyKey) return null;
  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <h2 className="text-lg font-semibold text-foreground">
          {title} ({items.length})
        </h2>
        <ListingStatusBadge status={status} />
      </div>
      {items.length === 0 ? (
        <EmptyState icon={Store} title={t(emptyKey)} compact />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((listing) => (
            <ListingCard key={listing.id} listing={listing} locale={locale} />
          ))}
        </div>
      )}
    </div>
  );
}
