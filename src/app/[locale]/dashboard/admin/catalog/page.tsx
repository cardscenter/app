import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";
import { CatalogEditForm } from "@/components/admin/catalog-edit-form";
import { createSeries, updateSeries, createCardSet, updateCardSet, updateCardMeta } from "@/actions/admin/catalog";
import { Search } from "lucide-react";

const SUB_TABS = [
  { key: "series", label: "Series" },
  { key: "cardsets", label: "CardSets" },
  { key: "cards", label: "Cards" },
] as const;

type SubTab = (typeof SUB_TABS)[number]["key"];

export default async function AdminCatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; series?: string; set?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const tab: SubTab = (SUB_TABS.find((t) => t.key === sp.tab)?.key ?? "series") as SubTab;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Catalog beheer</h1>
        <p className="text-sm text-muted-foreground">
          Beheer Series, CardSets en Cards. Bulk-imports blijven via seed/sync; deze UI is voor punt-correcties en handmatige toevoegingen.
        </p>
      </div>

      <nav className="flex gap-1 rounded-xl border bg-white p-1 dark:bg-slate-900">
        {SUB_TABS.map((t) => {
          const active = t.key === tab;
          return (
            <Link
              key={t.key}
              href={{ pathname: "/dashboard/admin/catalog", query: { tab: t.key } }}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                active ? "bg-primary text-white" : "text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>

      {tab === "series" && <SeriesTab />}
      {tab === "cardsets" && <CardSetsTab seriesId={sp.series} />}
      {tab === "cards" && <CardsTab setId={sp.set} q={sp.q ?? ""} />}
    </div>
  );
}

async function SeriesTab() {
  const [categories, series] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.series.findMany({
      orderBy: { name: "asc" },
      include: { category: { select: { name: true } }, _count: { select: { cardSets: true } } },
    }),
  ]);

  return (
    <div className="space-y-4">
      <section className="rounded-xl border bg-white p-4 dark:bg-slate-900">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground/70">
          Nieuwe series toevoegen
        </h2>
        <CatalogEditForm
          alwaysOpen
          fields={[
            { name: "name", label: "Naam" },
            { name: "tcgdexSeriesId", label: "TCGdex series id" },
            { name: "logoUrl", label: "Logo URL" },
            { name: "categoryId", label: `Category ID (kies uit: ${categories.map((c) => `${c.name}=${c.id}`).join(", ")})` },
          ]}
          action={createSeries}
          triggerLabel="Voeg toe"
        />
      </section>

      <div className="overflow-x-auto rounded-xl border bg-white dark:bg-slate-900">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left dark:bg-slate-800/60">
            <tr>
              <th className="px-3 py-2 font-medium">Naam</th>
              <th className="px-3 py-2 font-medium">Category</th>
              <th className="px-3 py-2 font-medium">TCGdex id</th>
              <th className="px-3 py-2 font-medium text-right">Sets</th>
              <th className="px-3 py-2 font-medium">Acties</th>
            </tr>
          </thead>
          <tbody>
            {series.map((s) => (
              <tr key={s.id} className="border-t">
                <td className="px-3 py-2 font-medium">{s.name}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{s.category.name}</td>
                <td className="px-3 py-2 text-xs">{s.tcgdexSeriesId ?? "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  <Link
                    href={{ pathname: "/dashboard/admin/catalog", query: { tab: "cardsets", series: s.id } }}
                    className="text-primary hover:underline"
                  >
                    {s._count.cardSets}
                  </Link>
                </td>
                <td className="px-3 py-2">
                  <CatalogEditForm
                    id={s.id}
                    fields={[
                      { name: "name", label: "Naam", defaultValue: s.name },
                      { name: "tcgdexSeriesId", label: "TCGdex id", defaultValue: s.tcgdexSeriesId ?? "" },
                      { name: "logoUrl", label: "Logo URL", defaultValue: s.logoUrl ?? "" },
                    ]}
                    action={updateSeries}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

async function CardSetsTab({ seriesId }: { seriesId?: string }) {
  const seriesList = await prisma.series.findMany({ orderBy: { name: "asc" } });

  const where = seriesId ? { seriesId } : {};
  const cardSets = await prisma.cardSet.findMany({
    where,
    orderBy: { name: "asc" },
    include: { series: { select: { name: true } }, _count: { select: { cards: true } } },
    take: 200,
  });

  return (
    <div className="space-y-4">
      <form method="get" className="flex gap-2">
        <input type="hidden" name="tab" value="cardsets" />
        <select
          name="series"
          defaultValue={seriesId ?? ""}
          className="rounded-md border bg-white px-3 py-1.5 text-sm dark:bg-slate-900"
        >
          <option value="">— Alle series —</option>
          {seriesList.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <button type="submit" className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white">
          Filter
        </button>
      </form>

      <section className="rounded-xl border bg-white p-4 dark:bg-slate-900">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground/70">
          Nieuwe set toevoegen
        </h2>
        <CatalogEditForm
          alwaysOpen
          fields={[
            { name: "name", label: "Naam" },
            { name: "seriesId", label: `Series ID${seriesId ? ` (default: ${seriesId})` : ""}`, defaultValue: seriesId ?? "" },
            { name: "tcgdexSetId", label: "TCGdex set id" },
            { name: "pokewalletSetId", label: "PokeWallet set ID" },
            { name: "pokewalletSetCode", label: "PokeWallet set code" },
            { name: "logoUrl", label: "Logo URL" },
            { name: "symbolUrl", label: "Symbol URL" },
            { name: "releaseDate", label: "Release date (YYYY-MM-DD)" },
            { name: "cardCount", label: "Aantal kaarten", type: "number" },
          ]}
          action={createCardSet}
          triggerLabel="Voeg toe"
        />
      </section>

      <div className="overflow-x-auto rounded-xl border bg-white dark:bg-slate-900">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left dark:bg-slate-800/60">
            <tr>
              <th className="px-3 py-2 font-medium">Naam</th>
              <th className="px-3 py-2 font-medium">Series</th>
              <th className="px-3 py-2 font-medium">PokeWallet code</th>
              <th className="px-3 py-2 font-medium">Release</th>
              <th className="px-3 py-2 font-medium text-right">Cards</th>
              <th className="px-3 py-2 font-medium">Acties</th>
            </tr>
          </thead>
          <tbody>
            {cardSets.map((s) => (
              <tr key={s.id} className="border-t">
                <td className="px-3 py-2 font-medium">{s.name}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{s.series.name}</td>
                <td className="px-3 py-2 text-xs">{s.pokewalletSetCode ?? "—"}</td>
                <td className="px-3 py-2 text-xs">{s.releaseDate ?? "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  <Link
                    href={{ pathname: "/dashboard/admin/catalog", query: { tab: "cards", set: s.id } }}
                    className="text-primary hover:underline"
                  >
                    {s._count.cards}
                  </Link>
                </td>
                <td className="px-3 py-2">
                  <CatalogEditForm
                    id={s.id}
                    fields={[
                      { name: "name", label: "Naam", defaultValue: s.name },
                      { name: "tcgdexSetId", label: "TCGdex id", defaultValue: s.tcgdexSetId ?? "" },
                      { name: "pokewalletSetId", label: "PW set ID", defaultValue: s.pokewalletSetId ?? "" },
                      { name: "pokewalletSetCode", label: "PW code", defaultValue: s.pokewalletSetCode ?? "" },
                      { name: "logoUrl", label: "Logo URL", defaultValue: s.logoUrl ?? "" },
                      { name: "symbolUrl", label: "Symbol URL", defaultValue: s.symbolUrl ?? "" },
                      { name: "releaseDate", label: "Release date", defaultValue: s.releaseDate ?? "" },
                      { name: "cardCount", label: "Aantal kaarten", type: "number", defaultValue: s.cardCount?.toString() ?? "" },
                    ]}
                    action={updateCardSet}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

async function CardsTab({ setId, q }: { setId?: string; q: string }) {
  const sets = await prisma.cardSet.findMany({ orderBy: { name: "asc" }, take: 500 });

  const where: Record<string, unknown> = {};
  if (setId) where.cardSetId = setId;
  if (q) where.name = { contains: q };

  const cards = setId || q
    ? await prisma.card.findMany({
        where,
        orderBy: { name: "asc" },
        take: 100,
        include: { cardSet: { select: { name: true } } },
      })
    : [];

  return (
    <div className="space-y-4">
      <form method="get" className="flex flex-wrap gap-2">
        <input type="hidden" name="tab" value="cards" />
        <select
          name="set"
          defaultValue={setId ?? ""}
          className="rounded-md border bg-white px-3 py-1.5 text-sm dark:bg-slate-900"
        >
          <option value="">— Alle sets —</option>
          {sets.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <div className="relative flex-1 min-w-[150px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Zoek kaartnaam"
            className="w-full rounded-md border bg-white py-1.5 pl-9 pr-3 text-sm dark:bg-slate-900"
          />
        </div>
        <button type="submit" className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white">
          Zoek
        </button>
      </form>

      {!setId && !q && (
        <div className="rounded-xl border border-dashed bg-slate-50 p-8 text-center text-sm text-muted-foreground dark:bg-slate-900/50">
          Selecteer een set of zoek op naam om kaarten te bekijken.
        </div>
      )}

      {(setId || q) && (
        <div className="overflow-x-auto rounded-xl border bg-white dark:bg-slate-900">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left dark:bg-slate-800/60">
              <tr>
                <th className="px-3 py-2 font-medium">Naam</th>
                <th className="px-3 py-2 font-medium">Set</th>
                <th className="px-3 py-2 font-medium">Local ID</th>
                <th className="px-3 py-2 font-medium">Rarity</th>
                <th className="px-3 py-2 font-medium text-right">Avg7 (€)</th>
                <th className="px-3 py-2 font-medium">Acties</th>
              </tr>
            </thead>
            <tbody>
              {cards.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">Geen resultaten.</td>
                </tr>
              )}
              {cards.map((c) => (
                <tr key={c.id} className="border-t">
                  <td className="px-3 py-2 font-medium">{c.name}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{c.cardSet.name}</td>
                  <td className="px-3 py-2 text-xs">{c.localId}</td>
                  <td className="px-3 py-2 text-xs">{c.rarity ?? "—"}</td>
                  <td className="px-3 py-2 text-right text-xs tabular-nums">{c.priceAvg7?.toFixed(2) ?? "—"}</td>
                  <td className="px-3 py-2">
                    <CatalogEditForm
                      id={c.id}
                      fields={[
                        { name: "name", label: "Naam", defaultValue: c.name },
                        { name: "rarity", label: "Rarity", defaultValue: c.rarity ?? "" },
                        { name: "imageUrl", label: "Image URL", defaultValue: c.imageUrl ?? "" },
                        { name: "imageUrlFull", label: "Image URL Full", defaultValue: c.imageUrlFull ?? "" },
                      ]}
                      action={updateCardMeta}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
