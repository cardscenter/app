import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export default async function DashboardPage() {
  const session = await auth();
  const t = await getTranslations("dashboard");
  const tw = await getTranslations("wallet");

  const user = await prisma.user.findUnique({
    where: { id: session!.user!.id },
    include: {
      _count: {
        select: {
          auctions: { where: { status: "ACTIVE" } },
          claimsales: { where: { status: "LIVE" } },
          purchasedItems: true,
        },
      },
    },
  });

  if (!user) return null;

  const stats = [
    { label: t("myAuctions"), value: user._count.auctions, href: "/dashboard/veilingen" },
    { label: t("myClaimsales"), value: user._count.claimsales, href: "/dashboard/claimsales" },
    { label: t("myPurchases"), value: user._count.purchasedItems, href: "/dashboard/aankopen" },
    { label: tw("balance"), value: `€${user.balance.toFixed(2)}`, href: "/dashboard/saldo" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
        {t("title")}
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        {user.displayName}
      </p>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Link
            key={stat.href}
            href={stat.href}
            className="rounded-lg border border-zinc-200 p-6 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
          >
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {stat.label}
            </p>
            <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
              {stat.value}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
