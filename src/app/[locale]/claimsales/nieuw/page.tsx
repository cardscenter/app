import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { checkClaimsaleLimit } from "@/lib/account-limits";
import { ClaimsaleForm } from "@/components/claimsale/claimsale-form";

export default async function NewClaimsalePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const t = await getTranslations("claimsale");
  const limit = await checkClaimsaleLimit(session.user.id!);

  const pokemon = await prisma.category.findFirst({ where: { slug: "pokemon" } });
  const seriesList = pokemon
    ? await prisma.series.findMany({
        where: { categoryId: pokemon.id },
        include: { cardSets: true },
        orderBy: { name: "asc" },
      })
    : [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
        {t("createTitle")}
      </h1>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
        Max {limit.maxItems} kaarten
      </p>
      <div className="mt-8">
        <ClaimsaleForm seriesList={seriesList} maxItems={limit.maxItems} />
      </div>
    </div>
  );
}
