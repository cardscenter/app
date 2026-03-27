import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { AuctionForm } from "@/components/auction/auction-form";

export default async function NewAuctionPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const t = await getTranslations("auction");

  const pokemon = await prisma.category.findFirst({ where: { slug: "pokemon" } });
  const seriesList = pokemon
    ? await prisma.series.findMany({
        where: { categoryId: pokemon.id },
        include: { cardSets: true },
        orderBy: { name: "asc" },
      })
    : [];

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
        {t("createTitle")}
      </h1>
      <div className="mt-8">
        <AuctionForm seriesList={seriesList} />
      </div>
    </div>
  );
}
