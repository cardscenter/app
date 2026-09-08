import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";
import { CatalogEditForm } from "@/components/admin/catalog-edit-form";
import { createSeries, updateSeries, createCardSet, updateCardSet, updateCardMeta } from "@/actions/admin/catalog";
import { Search } from "lucide-react";
import { DashboardPageHeader } from "@/components/dashboard/ui/page-header";
import { DashboardSection } from "@/components/dashboard/ui/section";
import { EmptyState } from "@/components/dashboard/ui/empty-state";

const SUB_TABS = [
  { key: "series", label: "Series" },
  { key: "cardsets", label: "CardSets" },
  { key: "cards", label: "Cards" },
] as const;

type SubTab = (typeof SUB_TABS)[number]["key"];

const TABLE_HEAD = "bg-muted text-left text-xs font-medium uppercase tracking-wider text-muted-foreground";
const TH = "px-4 py-2.5";
const TD = "px-4 py-3";

export default async function AdminCatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; series?: string; set?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const tab: SubTab = (SUB_TABS.find((t) => t.key === sp.tab)?.key ?? "series") as SubTab;

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="Catalog beheer"
        subtitle="Beheer Series, CardSets en Cards. Bulk-imports blijven via seed/sync; deze UI is voor punt-correcties en handmatige toevoegingen."
      />

      <nav className="inline-flex flex-wrap gap-1 dash-card p-1">
        {SUB_TABS.map((t) => {
          const active = t.key === tab;
          return (
            <Link
              key={t.key}
              href={{ pathname: "/dashboard/admin/catalog", query: { tab: t.key } }}
              className={
                active
                  ? "rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
                  : "rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              }
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
      <DashboardSection title="Nieuwe series toevoegen">
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
      </DashboardSection>

      <div className="overflow-x-auto dash-card">
        <table className="w-full text-sm">
          <thead className={TABLE_HEAD}>
            <tr>
              <th className={TH}>Naam</th>
              <th className={TH}>Category</th>
              <th className={TH}>TCGdex id</th>
              <th className={`${TH} text-right`}>Sets</th>
              <th className={TH}>Acties</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {series.map((s) => (
              <tr key={s.id} className="hover:bg-muted/40">
                <td className={`${TD} font-medium`}>{s.name}</td>
                <td className={`${TD} text-xs text-muted-foreground`}>{s.category.name}</td>
                <td className={`${TD} text-xs`}>{s.tcgdexSeriesId ?? "—"}</td>
                <td className={`${TD} text-right tabular-nums`}>
                  <Link
                    href={{ pathname: "/dashboard/admin/catalog", query: { tab: "cardsets", series: s.id } }}
                    className="text-primary hover:underline"
                  >
                    {s._count.cardSets}
                  </Link>
                </td>
                <td className={TD}>
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
          className="rounded-md border border-border bg-card px-3 py-1.5 text-sm"
        >
          <option value="">— Alle series —</option>
          {seriesList.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <button type="submit" className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary-hover">
          Filter
        </button>
      </form>

      <DashboardSection title="Nieuwe set toevoegen">
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
      </DashboardSection>

      <div className="overflow-x-auto dash-card">
        <table className="w-full text-sm">
          <thead className={TABLE_HEAD}>
            <tr>
              <th className={TH}>Naam</th>
              <th className={TH}>Series</th>
              <th className={TH}>PokeWallet code</th>
              <th className={TH}>Release</th>
              <th className={`${TH} text-right`}>Cards</th>
              <th className={TH}>Acties</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {cardSets.map((s) => (
              <tr key={s.id} className="hover:bg-muted/40">
                <td className={`${TD} font-medium`}>{s.name}</td>
                <td className={`${TD} text-xs text-muted-foreground`}>{s.series.name}</td>
                <td className={`${TD} text-xs`}>{s.pokewalletSetCode ?? "—"}</td>
                <td className={`${TD} text-xs`}>{s.releaseDate ?? "—"}</td>
                <td className={`${TD} text-right tabular-nums`}>
                  <Link
                    href={{ pathname: "/dashboard/admin/catalog", query: { tab: "cards", set: s.id } }}
                    className="text-primary hover:underline"
                  >
                    {s._count.cards}
                  </Link>
                </td>
                <td className={TD}>
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
          className="rounded-md border border-border bg-card px-3 py-1.5 text-sm"
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
            className="w-full rounded-md border border-border bg-card py-1.5 pl-9 pr-3 text-sm"
          />
        </div>
        <button type="submit" className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary-hover">
          Zoek
        </button>
      </form>

      {!setId && !q && (
        <EmptyState
          icon={Search}
          title="Selecteer een set of zoek op naam om kaarten te bekijken."
          compact
        />
      )}

      {(setId || q) && (
        <div className="overflow-x-auto dash-card">
          <table className="w-full text-sm">
            <thead className={TABLE_HEAD}>
              <tr>
                <th className={TH}>Naam</th>
                <th className={TH}>Set</th>
                <th className={TH}>Local ID</th>
                <th className={TH}>Rarity</th>
                <th className={`${TH} text-right`}>Avg7 (€)</th>
                <th className={TH}>Acties</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {cards.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">Geen resultaten.</td>
                </tr>
              )}
              {cards.map((c) => (
                <tr key={c.id} className="hover:bg-muted/40">
                  <td className={`${TD} font-medium`}>{c.name}</td>
                  <td className={`${TD} text-xs text-muted-foreground`}>{c.cardSet.name}</td>
                  <td className={`${TD} text-xs`}>{c.localId}</td>
                  <td className={`${TD} text-xs`}>{c.rarity ?? "—"}</td>
                  <td className={`${TD} text-right text-xs tabular-nums`}>{c.priceAvg7?.toFixed(2) ?? "—"}</td>
                  <td className={TD}>
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
