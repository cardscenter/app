import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Search, SearchX, ArrowRight, Layers, Sparkles, Store, Users } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { PageContainer } from "@/components/layout/page-container";
import { Pagination } from "@/components/ui/pagination";
import { SearchTabs, type SearchTab } from "@/components/search/search-tabs";
import { CardResultTile } from "@/components/search/card-result-tile";
import { PokemonResultTile } from "@/components/search/pokemon-result-tile";
import { UserResultCard } from "@/components/search/user-result-card";
import { SearchResultCard } from "@/components/search/search-result-card";
import { SearchSupplyFilters } from "@/components/search/search-supply-filters";
import { SearchPriceFilter } from "@/components/search/search-price-filter";
import { SearchSortBar } from "@/components/search/search-sort-bar";
import {
  getSupplyGuards,
  countAll,
  searchCards,
  searchPokemon,
  searchSupply,
  searchUsers,
  type SupplyFilters,
} from "@/lib/global-search";

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

export default async function ZoekenPage({ searchParams }: Props) {
  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const tab: TabKey = TAB_KEYS.includes(params.tab as TabKey)
    ? (params.tab as TabKey)
    : "alles";
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const minPrice = parseFloatParam(params.minPrice);
  const maxPrice = parseFloatParam(params.maxPrice);

  const [locale, t] = await Promise.all([getLocale(), getTranslations("search")]);

  const supplyFilters: SupplyFilters = {
    type:
      params.type === "auction" || params.type === "claimsale" || params.type === "listing"
        ? params.type
        : undefined,
    condition: params.condition || undefined,
    minPrice,
    maxPrice,
    sort:
      params.sort === "price_asc" ||
      params.sort === "price_desc" ||
      params.sort === "ending_soon" ||
      params.sort === "most_bids"
        ? params.sort
        : "newest",
  };

  const hasQuery = q.length >= 2;

  // Zoekform bovenaan (GET, geen client-JS nodig; behoudt actieve tab).
  const searchForm = (
    <form method="get" action={`/${locale}/zoeken`} className="flex max-w-2xl gap-2">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder={t("placeholder")}
          className="w-full rounded-lg border border-border bg-card py-2 pl-9 pr-4 text-base text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
        />
      </div>
      {tab !== "alles" && <input type="hidden" name="tab" value={tab} />}
      <button
        type="submit"
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90"
      >
        {t("searchAction")}
      </button>
    </form>
  );

  if (!hasQuery) {
    return (
      <PageContainer width="wide" className="py-8">
        <h1 className="mb-4 text-3xl font-bold text-foreground">{t("title")}</h1>
        {searchForm}
        <div className="mt-12 rounded-2xl border border-border bg-muted/30 p-12 text-center">
          <Search className="mx-auto mb-3 size-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">{t("emptyQuery")}</p>
        </div>
      </PageContainer>
    );
  }

  const guards = await getSupplyGuards();
  const counts = await countAll(q, guards);
  const totalAll = counts.cards + counts.pokemon + counts.supply + counts.users;

  const tabHref = (key: TabKey) =>
    key === "alles"
      ? `/zoeken?q=${encodeURIComponent(q)}`
      : `/zoeken?q=${encodeURIComponent(q)}&tab=${key}`;

  const tabs: SearchTab[] = [
    { key: "alles", label: t("tabAll"), count: totalAll, href: tabHref("alles") },
    { key: "kaarten", label: t("tabCards"), count: counts.cards, href: tabHref("kaarten") },
    { key: "pokemon", label: t("tabPokemon"), count: counts.pokemon, href: tabHref("pokemon") },
    { key: "aanbod", label: t("tabSupply"), count: counts.supply, href: tabHref("aanbod") },
    {
      key: "gebruikers",
      label: t("tabUsers"),
      count: counts.users,
      href: tabHref("gebruikers"),
    },
  ];

  const emptyState = (message: string) => (
    <div className="rounded-2xl border border-border bg-muted/30 p-12 text-center">
      <SearchX className="mx-auto mb-3 size-8 text-muted-foreground/30" />
      <p className="text-sm text-muted-foreground">{message}</p>
      <p className="mt-1 text-xs text-muted-foreground/70">{t("noResultsHint")}</p>
    </div>
  );

  let content: React.ReactNode;

  if (tab === "kaarten") {
    const cards = await searchCards(q, { page, pageSize: PAGE_SIZE, minPrice, maxPrice });
    content = (
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="lg:w-64 lg:shrink-0">
          <div className="lg:sticky lg:top-24">
            <SearchPriceFilter />
          </div>
        </div>
        <div className="min-w-0 flex-1">
          {cards.tooBroad ? (
            <div className="rounded-2xl border border-amber-300/50 bg-amber-50 p-8 text-center dark:border-amber-500/30 dark:bg-amber-500/10">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                {t("tooBroad", { count: cards.total })}
              </p>
            </div>
          ) : cards.items.length === 0 ? (
            emptyState(t("noResults", { query: q }))
          ) : (
            <>
              <p className="mb-4 text-sm text-muted-foreground">
                {t("results", { count: cards.total, query: q })}
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {cards.items.map((card) => (
                  <CardResultTile key={card.id} card={card} />
                ))}
              </div>
              <Pagination
                currentPage={cards.page}
                totalPages={cards.totalPages}
                baseUrl="/zoeken"
                locale={locale}
                extraParams={{
                  q,
                  tab: "kaarten",
                  ...(params.minPrice ? { minPrice: params.minPrice } : {}),
                  ...(params.maxPrice ? { maxPrice: params.maxPrice } : {}),
                }}
              />
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
      emptyState(t("noResults", { query: q }))
    ) : (
      <>
        <p className="mb-4 text-sm text-muted-foreground">
          {t("results", { count: pokemon.total, query: q })}
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {pokemon.items.map((p) => (
            <PokemonResultTile key={p.dexId} pokemon={p} />
          ))}
        </div>
        <Pagination
          currentPage={pokemon.page}
          totalPages={pokemon.totalPages}
          baseUrl="/zoeken"
          locale={locale}
          extraParams={{ q, tab: "pokemon" }}
        />
      </>
    );
  } else if (tab === "aanbod") {
    const supply = await searchSupply(q, supplyFilters, guards, {
      page,
      pageSize: PAGE_SIZE,
    });
    content = (
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <SearchSupplyFilters />
        <div className="min-w-0 flex-1">
          <SearchSortBar resultCount={supply.total} query={q} />
          {supply.items.length === 0 ? (
            <div className="mt-4">{emptyState(t("noResults", { query: q }))}</div>
          ) : (
            <>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {supply.items.map((result) => (
                  <SearchResultCard key={`${result.type}-${result.id}`} result={result} />
                ))}
              </div>
              {supply.capped && supply.page === supply.totalPages && (
                <p className="mt-4 text-center text-xs text-muted-foreground">
                  {t("cappedHint")}
                </p>
              )}
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
        emptyState(t("noResults", { query: q }))
      ) : (
        <>
          <p className="mb-4 text-sm text-muted-foreground">
            {t("results", { count: users.total, query: q })}
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {users.items.map((user) => (
              <UserResultCard key={user.id} user={user} />
            ))}
          </div>
          <Pagination
            currentPage={users.page}
            totalPages={users.totalPages}
            baseUrl="/zoeken"
            locale={locale}
            extraParams={{ q, tab: "gebruikers" }}
          />
        </>
      );
  } else {
    // Alles-tab: compacte preview per categorie met "Toon alle →".
    const [cards, pokemon, supply, users] = await Promise.all([
      counts.cards > 0
        ? searchCards(q, { page: 1, pageSize: 6 })
        : Promise.resolve(null),
      counts.pokemon > 0
        ? searchPokemon(q, { page: 1, pageSize: 6 })
        : Promise.resolve(null),
      counts.supply > 0
        ? searchSupply(q, { sort: "newest" }, guards, { page: 1, pageSize: 4 })
        : Promise.resolve(null),
      counts.users > 0
        ? searchUsers(q, guards, { page: 1, pageSize: 4 })
        : Promise.resolve(null),
    ]);

    const sectionHeader = (
      icon: React.ReactNode,
      label: string,
      count: number,
      key: TabKey
    ) => (
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          {icon}
          {label}
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">
            {count}
          </span>
        </h2>
        <Link
          href={tabHref(key)}
          scroll={false}
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          {t("showAll")}
          <ArrowRight className="size-3.5" />
        </Link>
      </div>
    );

    content =
      totalAll === 0 ? (
        emptyState(t("noResults", { query: q }))
      ) : (
        <div className="space-y-10">
          {cards && cards.items.length > 0 && (
            <section>
              {sectionHeader(
                <Layers className="size-5 text-primary" />,
                t("tabCards"),
                counts.cards,
                "kaarten"
              )}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {cards.items.map((card) => (
                  <CardResultTile key={card.id} card={card} />
                ))}
              </div>
            </section>
          )}

          {cards?.tooBroad && (
            <section>
              {sectionHeader(
                <Layers className="size-5 text-primary" />,
                t("tabCards"),
                counts.cards,
                "kaarten"
              )}
              <div className="rounded-2xl border border-amber-300/50 bg-amber-50 p-6 text-center dark:border-amber-500/30 dark:bg-amber-500/10">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                  {t("tooBroad", { count: counts.cards })}
                </p>
              </div>
            </section>
          )}

          {pokemon && pokemon.items.length > 0 && (
            <section>
              {sectionHeader(
                <Sparkles className="size-5 text-amber-500" />,
                t("tabPokemon"),
                counts.pokemon,
                "pokemon"
              )}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {pokemon.items.map((p) => (
                  <PokemonResultTile key={p.dexId} pokemon={p} />
                ))}
              </div>
            </section>
          )}

          {supply && supply.items.length > 0 && (
            <section>
              {sectionHeader(
                <Store className="size-5 text-emerald-600" />,
                t("tabSupply"),
                counts.supply,
                "aanbod"
              )}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {supply.items.map((result) => (
                  <SearchResultCard key={`${result.type}-${result.id}`} result={result} />
                ))}
              </div>
            </section>
          )}

          {users && users.items.length > 0 && (
            <section>
              {sectionHeader(
                <Users className="size-5 text-violet-500" />,
                t("tabUsers"),
                counts.users,
                "gebruikers"
              )}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {users.items.map((user) => (
                  <UserResultCard key={user.id} user={user} />
                ))}
              </div>
            </section>
          )}
        </div>
      );
  }

  return (
    <PageContainer width="wide" className="py-8">
      <h1 className="mb-4 text-3xl font-bold text-foreground">{t("title")}</h1>
      {searchForm}
      <div className="mt-6">
        <SearchTabs tabs={tabs} active={tab} />
      </div>
      <div className="mt-6">{content}</div>
    </PageContainer>
  );
}
