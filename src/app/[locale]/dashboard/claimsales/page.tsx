import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export default async function MyClaimsalesPage() {
  const session = await auth();
  const t = await getTranslations("dashboard");
  const tc = await getTranslations("claimsale");

  const claimsales = await prisma.claimsale.findMany({
    where: { sellerId: session!.user!.id },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { items: true } },
      items: { where: { status: "SOLD" }, select: { id: true } },
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">
          {t("myClaimsales")}
        </h1>
        <Link
          href="/claimsales/nieuw"
          className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
        >
          + {tc("createTitle")}
        </Link>
      </div>

      {claimsales.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">
          {t("noActiveClaimsales")}
        </p>
      ) : (
        <div className="mt-6 space-y-4">
          {claimsales.map((cs) => (
            <Link
              key={cs.id}
              href={`/claimsales/${cs.id}`}
              className="block glass rounded-2xl p-4 transition-colors hover:bg-muted/50"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-foreground">{cs.title}</h3>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  cs.status === "LIVE"
                    ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                    : cs.status === "DRAFT"
                    ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
                    : "bg-muted text-muted-foreground"
                }`}>
                  {cs.status}
                </span>
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
