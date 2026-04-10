import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { Link } from "@/i18n/navigation";
import { ArrowLeft } from "lucide-react";
import { LootboxOpener } from "@/components/customization/lootbox-opener";
import { EmberBalance } from "@/components/customization/ember-balance";
import { notFound } from "next/navigation";

export default async function OpenLootboxPage({
  params,
}: {
  params: Promise<{ lootboxId: string }>;
}) {
  const { lootboxId } = await params;
  const t = await getTranslations("customization");
  const session = await auth();

  const lootbox = await prisma.lootbox.findUnique({
    where: { id: lootboxId, isActive: true },
    include: {
      bundle: true,
      items: {
        include: {
          item: {
            select: { id: true, key: true, name: true, rarity: true, type: true, assetPath: true },
          },
        },
      },
    },
  });

  if (!lootbox) notFound();

  let emberBalance = 0;
  if (session?.user?.id) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { emberBalance: true },
    });
    emberBalance = user?.emberBalance ?? 0;
  }

  const previewItems = lootbox.items.map((li) => ({
    id: li.item.id,
    key: li.item.key,
    name: li.item.name,
    rarity: li.item.rarity,
    type: li.item.type,
    assetPath: li.item.assetPath,
  }));

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/customization/packs" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{lootbox.name}</h1>
          <p className="text-sm text-muted-foreground">{lootbox.bundle.name}</p>
        </div>
        {session?.user?.id && <EmberBalance balance={emberBalance} size="lg" />}
      </div>

      <LootboxOpener
        lootboxId={lootbox.id}
        lootboxName={lootbox.name}
        emberCost={lootbox.emberCost}
        previewItems={previewItems}
        currentBalance={emberBalance}
        isLoggedIn={!!session?.user?.id}
      />
    </div>
  );
}
