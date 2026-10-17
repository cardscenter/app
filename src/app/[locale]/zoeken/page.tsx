import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Search, SearchX, ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Pagination } from "@/components/ui/pagination";
import { SearchTabs, type SearchTab } from "@/components/search/search-tabs";
import { CardResultTile } from "@/components/search/card-result-tile";
import { PokemonResultTile } from "@/components/search/pokemon-result-tile";
import { UserResultCard } from "@/components/search/user-result-card";
import { SearchResultCard } from "@/components/search/search-result-card";
import { SearchSupplyFilters } from "@/components/search/search-supply-filters";
import { SearchPriceFilter } from "@/components/search/search-price-filter";
import { SearchSortBar } from "@/components/search/search-sort-bar";
import { CenteredHero } from "@/components/ploy/centered-hero";
import { Pill } from "@/components/ploy/pill";
import { PunchCard } from "@/components/ploy/punch-card";
import { SEARCH_INPUT, PILL_RED, H2 } from "@/components/ploy/tile-styles";
import { getSupplyGuards, countAll, searchCards, searchPokemon, searchSupply, searchUsers, type SupplyFilters } from "@/lib/global-search";

export const metadata: Metadata = {
  title: "Zoeken — Cards Center",
};

const PAGE_SIZE = 24;
const TAB_KEYS = ["alles", "kaarten", "pokemon", "aanbod", "gebruikers"] as const;
type TabKey = (typeof TAB_KEYS)[number];

interface Props {
  searchParams: Promise<{
    q?: string;
    tab?: string;
    page?: string;
    type?: string;
    condition?: string;
    minPrice?: string;
    maxPrice?: string;
    sort?: string;
  }>;
}

function parseFloatParam(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const n = parseFloat(raw);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

/** Zoekpagina (design-pass Fase E): hero met zoekveld, pil-tabs, tegels per categorie. */
export default async function ZoekenPage({ searchParams }: Props) {
  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const requestedTab: TabKey = TAB_KEYS.includes(params.tab as TabKey) ? (params.tab as TabKey) : "alles";
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const minPrice = parseFloatParam(params.minPrice);
  const maxPrice = parseFloatParam(params.maxPrice);

  const [locale, t, guards] = await Promise.all([getLocale(), getTranslations("search"), getSupplyGuards()]);

  // Kaartendatabase verborgen en geen handel zichtbaar: zoeken is dan alleen
  // nog spelers zoeken, zonder tabs (ronde G, 2026-10-17).
  const playersOnly = !guards.cardDatabase && guards.enabledTypes.size === 0;
  const tab: TabKey = playersOnly
    ? "gebruikers"
    : !guards.cardDatabase && (requestedTab === "kaarten" || requestedTab === "pokemon")
      ? "alles"
      : requestedTab;

  const supplyFilters: SupplyFilters = {
    type: params.type === "auction" || params.type === "claimsale" || params.type === "listing" ? params.type : undefined,
    condition: params.condition || undefined,
    minPrice,
    maxPrice,
    sort: params.sort === "price_asc" || params.sort === "price_desc" || params.sort === "ending_soon" || params.sort === "most_bids" ? params.sort : "newest",
  };

  const hasQuery = q.length >= 2;

  // Zoekform in de hero (GET, geen client-JS nodig; behoudt actieve tab).
  const hero = (
    <CenteredHero
      title={q ? t("heroTitleQuery") : playersOnly ? t("heroTitlePlayers") : t("heroTitle")}
      highlightWord={playersOnly ? t("heroWordPlayers") : t("heroWord")}
      highlightColor="yellow"
      size={3}
      className="pb-6 lg:pb-8"
    >
      <form method="get" action={`/${locale}/zoeken`} className="flex w-full max-w-2xl items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[var(--foreground)]/45" />
          <input type="search" name="q" defaultValue={q} placeholder={playersOnly ? t("placeholderPlayers") : t("placeholder")} className={`${SEARCH_INPUT} pl-12 pr-4`} />
        </div>
        {tab !== "alles" && !playersOnly && <input type="hidden" name="tab" value={tab} />}
        <button type="submit" className={`${PILL_RED} py-3.5`}>
          {t("searchAction")}
        </button>
      </form>
    </CenteredHero>
  );

  const wrap = (children: React.ReactNode) => (
    <div className="cc-landing overflow-clip">
      {hero}
      <section className="flex justify-center px-4 pb-16 sm:px-5 lg:px-6 lg:pb-24">
        <div className="w-full max-w-6xl">{children}</div>
      </section>
    </div>
  );

  const emptyState = (message: string, hint?: string) => (
    <PunchCard className="bg-white p-12 text-center" dot="var(--border)">
      <SearchX className="mx-auto mb-3 size-8 text-[var(--foreground)]/30" />
      <p className="text-sm text-[var(--foreground)]/70">{message}</p>
      {hint && <p className="mt-1 text-xs text-[var(--foreground)]/50">{hint}</p>}
    </PunchCard>
  );

  if (!hasQuery) {
    return wrap(
      <PunchCard className="bg-white p-12 text-center" dot="var(--border)">
        <Search className="mx-auto mb-3 size-8 text-[var(--foreground)]/30" />
        <p className="text-sm text-[var(--foreground)]/70">{t("emptyQuery")}</p>
      </PunchCard>,
    );
  }

  const counts = await countAll(q, guards);
  const totalAll = counts.cards + counts.pokemon + counts.supply + counts.users;

  const tabHref = (key: TabKey) => (key === "alles" ? `/zoeken?q=${encodeURIComponent(q)}` : `/zoeken?q=${encodeURIComponent(q)}&tab=${key}`);

  const tabs: SearchTab[] = [
    { key: "alles", label: t("tabAll"), count: totalAll, href: tabHref("alles") },
    ...(guards.cardDatabase
      ? [
          { key: "kaarten", label: t("tabCards"), count: counts.cards, href: tabHref("kaarten") },
          { key: "pokemon", label: t("tabPokemon"), count: counts.pokemon, href: tabHref("pokemon") },
        ]
      : []),
    // Aanbod-tab alleen als er een handelssoort zichtbaar is (feature-flags, Fase 1).
    ...(guards.enabledTypes.size > 0 ? [{ key: "aanbod", label: t("tabSupply"), count: counts.supply, href: tabHref("aanbod") }] : []),
    { key: "gebruikers", label: t("tabUsers"), count: counts.users, href: tabHref("gebruikers") },
  ];

  const resultsLine = (count: number) => <p className="mb-4 text-sm text-[var(--foreground)]/55">{t("results", { count, query: q })}</p>;
  const tooBroad = (count: number) => (
    <div className="rounded-[12px] bg-[var(--pastel-yellow)] p-8 text-center">
      <p className="text-sm font-medium text-[var(--foreground)]">{t("tooBroad", { count })}</p>
    </div>
  );

  let content: React.ReactNode;

  if (tab === "kaarten") {
    const cards = await searchCards(q, { page, pageSize: PAGE_SIZE, minPrice, maxPrice });
    content = (
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="lg:w-64 lg:shrink-0">
          <div className="lg:sticky lg:top-[calc(var(--site-nav-offset)+1rem)]">
            <SearchPriceFilter />
          </div>
        </div>
        <div className="min-w-0 flex-1">
          {cards.tooBroad ? (
            tooBroad(cards.total)
          ) : cards.items.length === 0 ? (
            emptyState(t("noResults", { query: q }), t("noResultsHint"))
          ) : (
            <>
              {resultsLine(cards.total)}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {cards.items.map((card) => (
                  <CardResultTile key={card.id} card={card} />
                ))}
              </div>
              <Pagination currentPage={cards.page} totalPages={cards.totalPages} baseUrl="/zoeken" locale={locale} extraParams={{ q, tab: "kaarten", ...(params.minPrice ? { minPrice: params.minPrice } : {}), ...(params.maxPrice ? { maxPrice: params.maxPrice } : {}) }} />
            </>
          )}
        </div>
      </div>
    );
  } else if (tab === "pokemon") {
    const pokemon = await searchPokemon(q, { page, pageSize: PAGE_SIZE });
    content = pokemon.unavailable ? (
      emptyState(t("pokeapiDown"))
    ) : pokemon.items.length === 0 ? (
      emptyState(t("noResults", { query: q }), t("noResultsHint"))
    ) : (
      <>
        {resultsLine(pokemon.total)}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {pokemon.items.map((p) => (
            <PokemonResultTile key={p.dexId} pokemon={p} />
          ))}
        </div>
        <Pagination currentPage={pokemon.page} totalPages={pokemon.totalPages} baseUrl="/zoeken" locale={locale} extraParams={{ q, tab: "pokemon" }} />
      </>
    );
  } else if (tab === "aanbod") {
    const supply = await searchSupply(q, supplyFilters, guards, { page, pageSize: PAGE_SIZE });
    content = (
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <SearchSupplyFilters />
        <div className="min-w-0 flex-1">
          <SearchSortBar resultCount={supply.total} query={q} />
          {supply.items.length === 0 ? (
            <div className="mt-4">{emptyState(t("noResults", { query: q }), t("noResultsHint"))}</div>
          ) : (
            <>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {supply.items.map((result) => (
                  <SearchResultCard key={`${result.type}-${result.id}`} result={result} />
                ))}
              </div>
              {supply.capped && supply.page === supply.totalPages && <p className="mt-4 text-center text-xs text-[var(--foreground)]/55">{t("cappedHint")}</p>}
              <Pagination
                currentPage={supply.page}
                totalPages={supply.totalPages}
                baseUrl="/zoeken"
                locale={locale}
                extraParams={{
                  q,
                  tab: "aanbod",
                  ...(params.type ? { type: params.type } : {}),
                  ...(params.condition ? { condition: params.condition } : {}),
                  ...(params.minPrice ? { minPrice: params.minPrice } : {}),
                  ...(params.maxPrice ? { maxPrice: params.maxPrice } : {}),
                  ...(params.sort ? { sort: params.sort } : {}),
                }}
              />
            </>
          )}
        </div>
      </div>
    );
  } else if (tab === "gebruikers") {
    const users = await searchUsers(q, guards, { page, pageSize: PAGE_SIZE });
    content =
      users.items.length === 0 ? (
        emptyState(t("noResults", { query: q }), playersOnly ? t("noResultsHintPlayers") : t("noResultsHint"))
      ) : (
        <>
          {resultsLine(users.total)}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {users.items.map((user) => (
              <UserResultCard key={user.id} user={user} />
            ))}
          </div>
          <Pagination currentPage={users.page} totalPages={users.totalPages} baseUrl="/zoeken" locale={locale} extraParams={playersOnly ? { q } : { q, tab: "gebruikers" }} />
        </>
      );
  } else {
    // Alles-tab: compacte preview per categorie met "Toon alle →".
    const [cards, pokemon, supply, users] = await Promise.all([
      counts.cards > 0 ? searchCards(q, { page: 1, pageSize: 6 }) : Promise.resolve(null),
      counts.pokemon > 0 ? searchPokemon(q, { page: 1, pageSize: 6 }) : Promise.resolve(null),
      counts.supply > 0 ? searchSupply(q, { sort: "newest" }, guards, { page: 1, pageSize: 3 }) : Promise.resolve(null),
      counts.users > 0 ? searchUsers(q, guards, { page: 1, pageSize: 3 }) : Promise.resolve(null),
    ]);

    const sectionHeader = (label: string, count: number, key: TabKey) => (
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className={`flex items-center gap-3 ${H2}`}>
          {label}
          <Pill tone="white">{count}</Pill>
        </h2>
        <Link href={tabHref(key)} scroll={false} className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--primary)] no-underline hover:underline">
          {t("showAll")}
          <ArrowRight className="size-3.5" />
        </Link>
      </div>
    );

    content =
      totalAll === 0 ? (
        emptyState(t("noResults", { query: q }), t("noResultsHint"))
      ) : (
        <div className="space-y-12">
          {cards && cards.items.length > 0 && (
            <section>
              {sectionHeader(t("tabCards"), counts.cards, "kaarten")}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {cards.items.map((card) => (
                  <CardResultTile key={card.id} card={card} />
                ))}
              </div>
            </section>
          )}

          {cards?.tooBroad && (
            <section>
              {sectionHeader(t("tabCards"), counts.cards, "kaarten")}
              {tooBroad(counts.cards)}
            </section>
          )}

          {pokemon && pokemon.items.length > 0 && (
            <section>
              {sectionHeader(t("tabPokemon"), counts.pokemon, "pokemon")}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {pokemon.items.map((p) => (
                  <PokemonResultTile key={p.dexId} pokemon={p} />
                ))}
              </div>
            </section>
          )}

          {supply && supply.items.length > 0 && (
            <section>
              {sectionHeader(t("tabSupply"), counts.supply, "aanbod")}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {supply.items.map((result) => (
                  <SearchResultCard key={`${result.type}-${result.id}`} result={result} />
                ))}
              </div>
            </section>
          )}

          {users && users.items.length > 0 && (
            <section>
              {sectionHeader(t("tabUsers"), counts.users, "gebruikers")}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {users.items.map((user) => (
                  <UserResultCard key={user.id} user={user} />
                ))}
              </div>
            </section>
          )}
        </div>
      );
  }

  if (playersOnly) return wrap(content);

  return wrap(
    <>
      <SearchTabs tabs={tabs} active={tab} />
      <div className="mt-8">{content}</div>
    </>,
  );
}
