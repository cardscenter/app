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
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          {t("myClaimsales")}
        </h1>
        <Link
          href="/claimsales/nieuw"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          + {tc("createTitle")}
        </Link>
      </div>

      {claimsales.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-500 dark:text-zinc-400">
          {t("noActiveClaimsales")}
        </p>
      ) : (
        <div className="mt-6 space-y-4">
          {claimsales.map((cs) => (
            <Link
              key={cs.id}
              href={`/claimsales/${cs.id}`}
              className="block rounded-lg border border-zinc-200 p-4 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-zinc-900 dark:text-zinc-50">{cs.title}</h3>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  cs.status === "LIVE"
                    ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                    : cs.status === "DRAFT"
                    ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
                    : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                }`}>
                  {cs.status}
                </span>
              </div>
              <div className="mt-2 flex gap-4 text-sm text-zinc-500 dark:text-zinc-400">
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
