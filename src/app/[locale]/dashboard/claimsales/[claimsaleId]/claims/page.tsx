import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { ImageIcon, MapPin, Package, User, ExternalLink } from "lucide-react";
import { ShipBundleForm } from "@/components/dashboard/ship-bundle-form";

export default async function ClaimsaleClaimsPage({
  params,
}: {
  params: Promise<{ claimsaleId: string }>;
}) {
  const { claimsaleId } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const t = await getTranslations("sellerClaims");
  const tBreadcrumbs = await getTranslations("breadcrumbs");
  const tDashboard = await getTranslations("dashboard");

  const claimsale = await prisma.claimsale.findUnique({
    where: { id: claimsaleId },
    include: {
      items: {
        where: { status: "SOLD" },
        include: {
          buyer: { select: { id: true, displayName: true } },
          shippingBundle: {
            select: {
              id: true, shippingCost: true, totalItemCost: true, totalCost: true, status: true,
              trackingUrl: true,
              buyerStreet: true, buyerHouseNumber: true, buyerPostalCode: true, buyerCity: true, buyerCountry: true,
              shippingMethod: { select: { carrier: true, serviceName: true } },
            },
          },
        },
        orderBy: { updatedAt: "desc" },
      },
    },
  });

  if (!claimsale) notFound();
  if (claimsale.sellerId !== session.user.id) notFound();

  // Group sold items by buyer
  const buyerGroups = new Map<
    string,
    {
      buyerName: string;
      items: typeof claimsale.items;
      bundleStatus: string;
      shippingCost: number;
      totalItemCost: number;
      totalCost: number;
      bundleId: string | null;
      trackingUrl: string | null;
      buyerAddress: { street: string; houseNumber: string; postalCode: string; city: string; country: string } | null;
      shippingMethodName: string | null;
    }
  >();

  for (const item of claimsale.items) {
    if (!item.buyer) continue;
    const buyerId = item.buyer.id;

    if (!buyerGroups.has(buyerId)) {
      const bundle = item.shippingBundle;
      const showAddress = bundle && ["PAID", "SHIPPED", "COMPLETED"].includes(bundle.status);
      buyerGroups.set(buyerId, {
        buyerName: item.buyer.displayName,
        items: [],
        bundleId: bundle?.id ?? null,
        bundleStatus: bundle?.status ?? "PENDING",
        trackingUrl: bundle?.trackingUrl ?? null,
        shippingCost: bundle?.shippingCost ?? 0,
        totalItemCost: 0,
        totalCost: 0,
        buyerAddress: showAddress && bundle?.buyerStreet ? {
          street: bundle.buyerStreet,
          houseNumber: bundle.buyerHouseNumber ?? "",
          postalCode: bundle.buyerPostalCode ?? "",
          city: bundle.buyerCity ?? "",
          country: bundle.buyerCountry ?? "",
        } : null,
        shippingMethodName: bundle?.shippingMethod
          ? `${bundle.shippingMethod.carrier} — ${bundle.shippingMethod.serviceName}`
          : null,
      });
    }

    const group = buyerGroups.get(buyerId)!;
    group.items.push(item);
    group.totalItemCost += item.price;
    group.totalCost = group.totalItemCost + group.shippingCost;
  }

  const totalRevenue = claimsale.items.reduce((sum, i) => sum + i.price, 0);

  const statusColors: Record<string, string> = {
    PENDING: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
    PAID: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    SHIPPED: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
    COMPLETED: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
    CANCELLED: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  };

  const statusLabels: Record<string, string> = {
    PENDING: t("statusPending"),
    PAID: t("statusPaid"),
    SHIPPED: t("statusShipped"),
    COMPLETED: t("statusCompleted"),
    CANCELLED: t("statusCancelled"),
  };

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: tDashboard("myClaimsales"), href: "/dashboard/claimsales" },
          { label: claimsale.title, href: `/claimsales/${claimsaleId}` },
          { label: t("title") },
        ]}
      />

      <h1 className="text-2xl font-bold text-foreground">
        {t("title")}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {claimsale.title}
      </p>

      {/* Summary stats */}
      <div className="mt-6 grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-white/60 p-4 backdrop-blur-sm">
          <p className="text-xs text-muted-foreground">{t("totalItems")}</p>
          <p className="text-2xl font-bold text-foreground">
            {claimsale.items.length}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-white/60 p-4 backdrop-blur-sm">
          <p className="text-xs text-muted-foreground">{t("totalRevenue")}</p>
          <p className="text-2xl font-bold text-foreground">
            &euro;{totalRevenue.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Buyer groups */}
      {buyerGroups.size === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">{t("noClaims")}</p>
      ) : (
        <div className="mt-6 space-y-4">
          {Array.from(buyerGroups.entries()).map(([buyerId, group]) => (
            <div
              key={buyerId}
              className="overflow-hidden rounded-2xl border border-border bg-white/60 backdrop-blur-sm"
            >
              {/* Buyer header */}
              <div className="flex items-center justify-between border-b border-border bg-muted/50/80 px-5 py-3">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-semibold text-foreground">
                    {t("buyer")}: {group.buyerName}
                  </span>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[group.bundleStatus] ?? statusColors.PENDING}`}>
                  {statusLabels[group.bundleStatus] ?? group.bundleStatus}
                </span>
              </div>

              {/* Buyer address (visible after payment) */}
              {group.buyerAddress && (
                <div className="border-b border-border px-5 py-3">
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                    <div>
                      <p className="font-medium text-foreground">{t("shippingAddress")}</p>
                      <p className="text-muted-foreground">
                        {group.buyerAddress.street} {group.buyerAddress.houseNumber}
                      </p>
                      <p className="text-muted-foreground">
                        {group.buyerAddress.postalCode} {group.buyerAddress.city}
                      </p>
                      <p className="text-muted-foreground">
                        {group.buyerAddress.country}
                      </p>
                      {group.shippingMethodName && (
                        <p className="mt-1 text-xs text-muted-foreground0">
                          <Package className="inline h-3 w-3 mr-1" />{group.shippingMethodName}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Items */}
              <div className="divide-y divide-border px-5">
                {group.items.map((item) => {
                  let images: string[] = [];
                  try {
                    images = JSON.parse(item.imageUrls);
                  } catch { /* ignore */ }

                  return (
                    <div key={item.id} className="flex items-center gap-3 py-3">
                      {images.length > 0 ? (
                        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md border border-border">
                          <img src={images[0]} alt={item.cardName} className="h-full w-full object-cover" />
                        </div>
                      ) : (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border bg-muted/50">
                          <ImageIcon className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {item.cardName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {item.condition}
                          {item.reference && (
                            <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                              {item.reference}
                            </span>
                          )}
                        </p>
                      </div>
                      <p className="shrink-0 text-sm font-medium text-foreground">
                        &euro;{item.price.toFixed(2)}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Totals */}
              <div className="border-t border-border bg-muted/50/80 px-5 py-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("items")}</span>
                  <span className="font-medium">&euro;{group.totalItemCost.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("shipping")}</span>
                  <span className="font-medium">&euro;{group.shippingCost.toFixed(2)}</span>
                </div>
                <div className="mt-1 flex justify-between border-t border-border pt-1 text-sm">
                  <span className="font-semibold">{t("total")}</span>
                  <span className="font-semibold">&euro;{group.totalCost.toFixed(2)}</span>
                </div>
              </div>

              {/* Ship action or tracking info */}
              {group.bundleId && group.bundleStatus === "PAID" && (
                <div className="border-t border-border px-5 py-3">
                  <ShipBundleForm bundleId={group.bundleId} />
                </div>
              )}
              {group.trackingUrl && (
                <div className="border-t border-border px-5 py-3">
                  <a
                    href={group.trackingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    {t("viewTracking")}
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
