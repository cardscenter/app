import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { Link } from "@/i18n/navigation";
import { ArrowLeft, BookOpen } from "lucide-react";
import { EmberBalance } from "@/components/customization/ember-balance";

export default async function ChaptersPage() {
  const t = await getTranslations("customization");
  const session = await auth();

  const bundles = await prisma.cosmeticBundle.findMany({
    where: { isActive: true },
    include: {
      _count: { select: { items: true } },
    },
    orderBy: { sortOrder: "asc" },
  });

  let emberBalance = 0;
  if (session?.user?.id) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { emberBalance: true },
    });
    emberBalance = user?.emberBalance ?? 0;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/customization" className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          <ArrowLeft className="size-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{t("chaptersTitle")}</h1>
          <p className="text-sm text-muted-foreground">{t("chaptersSubtitle")}</p>
        </div>
        {session?.user?.id && <EmberBalance balance={emberBalance} size="lg" />}
      </div>

      {bundles.length === 0 ? (
        <div className="glass rounded-2xl p-16 text-center">
          <BookOpen className="mx-auto mb-4 size-12 text-muted-foreground/30" />
          <p className="text-lg font-medium text-muted-foreground">{t("noChapters")}</p>
          <p className="mt-2 text-sm text-muted-foreground">{t("noChaptersDesc")}</p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2">
          {bundles.map((bundle) => (
            <div key={bundle.id} className="glass overflow-hidden rounded-2xl p-6">
              <h2 className="text-xl font-bold">{bundle.name}</h2>
              {bundle.description && (
                <p className="mt-2 text-sm text-muted-foreground">{bundle.description}</p>
              )}
              <p className="mt-3 text-sm text-muted-foreground">
                {t("containsItems", { count: bundle._count.items })}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
