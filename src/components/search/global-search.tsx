"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { Search, X, BadgeCheck, ArrowRight, Gavel, Tag, Store, User as UserIcon } from "lucide-react";
import type { SearchSuggestions } from "@/lib/global-search";

/**
 * Header-zoekbalk met live suggesties (Kaarten / Pokémon / Aanbod /
 * Gebruikers) uit /api/search/suggest. Twee varianten:
 *  - "desktop": loep-icoon dat naar links uitklapt (md+), dropdown eronder
 *  - "mobile": full-width balk in het mobiele menu, dropdown eronder
 * Toetsenbord: ↑/↓ door alle rijen (wrap), Enter navigeert, Escape sluit.
 */

const DEBOUNCE_MS = 250;
const MIN_QUERY = 2;

const SUPPLY_ICONS = {
  auction: Gavel,
  claimsale: Tag,
  listing: Store,
} as const;

const SUPPLY_COLORS = {
  auction: "text-sky-400",
  claimsale: "text-amber-400",
  listing: "text-emerald-400",
} as const;

function useSuggest(value: string) {
  const [data, setData] = useState<SearchSuggestions | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = value.trim();
    if (q.length < MIN_QUERY) {
      setData(null);
      setLoading(false);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    const id = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search/suggest?q=${encodeURIComponent(q)}`, {
          signal: ctrl.signal,
        });
        if (res.ok) {
          const json = (await res.json()) as SearchSuggestions;
          // Stale responses zijn al afgevangen via abort; dubbele check op query.
          setData(json);
        }
        setLoading(false);
      } catch {
        // Abort of netwerkfout — vorige resultaten blijven staan (geen flikker).
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(id);
      ctrl.abort();
    };
  }, [value]);

  return { data, loading };
}

interface GlobalSearchProps {
  variant: "desktop" | "mobile";
  /** Wordt aangeroepen ná navigatie (mobiel: sluit het menu). */
  onNavigate?: () => void;
}

export function GlobalSearch({ variant, onNavigate }: GlobalSearchProps) {
  const t = useTranslations("search");
  const router = useRouter();
  const [open, setOpen] = useState(variant === "mobile");
  const [value, setValue] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { data } = useSuggest(value);

  const query = value.trim();
  const showDropdown = open && query.length >= MIN_QUERY && data !== null;

  // Platte lijst voor toetsenbord-navigatie: alle rijen + footer.
  const allHref = `/zoeken?q=${encodeURIComponent(query)}`;
  const flatItems: { key: string; href: string }[] = data
    ? [
        ...data.cards.map((c) => ({ key: `card-${c.id}`, href: c.href })),
        ...data.pokemon.map((p) => ({ key: `pokemon-${p.dexId}`, href: p.href })),
        ...data.supply.map((s) => ({ key: `supply-${s.type}-${s.id}`, href: s.href })),
        ...data.users.map((u) => ({ key: `user-${u.id}`, href: u.href })),
        { key: "footer", href: allHref },
      ]
    : [];

  // Nieuwe data = selectie resetten.
  useEffect(() => {
    setActiveIndex(-1);
  }, [data]);

  useEffect(() => {
    if (variant === "desktop" && open) inputRef.current?.focus();
  }, [open, variant]);

  // Click-outside + Escape sluiten (desktop klapt in, mobiel sluit dropdown).
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        if (variant === "desktop") setOpen(false);
        else setValue("");
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open, variant]);

  const navigate = useCallback(
    (href: string) => {
      router.push(href);
      setValue("");
      setActiveIndex(-1);
      if (variant === "desktop") setOpen(false);
      onNavigate?.();
    },
    [router, variant, onNavigate]
  );

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      if (variant === "desktop") setOpen(false);
      setValue("");
      setActiveIndex(-1);
      return;
    }
    if (!showDropdown || flatItems.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % flatItems.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? flatItems.length - 1 : i - 1));
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (activeIndex >= 0 && flatItems[activeIndex]) {
      navigate(flatItems[activeIndex].href);
      return;
    }
    if (query.length > 0) navigate(allHref);
  }

  // ---------------------------------------------------------------------
  // Dropdown-panel (gedeeld tussen beide varianten)
  // ---------------------------------------------------------------------

  // Startindexen per groep voor active-highlight over de platte lijst heen.
  const cardsStart = 0;
  const pokemonStart = data ? data.cards.length : 0;
  const supplyStart = data ? pokemonStart + data.pokemon.length : 0;
  const usersStart = data ? supplyStart + data.supply.length : 0;
  const footerIndex = data ? usersStart + data.users.length : 0;

  const rowClass = (index: number) =>
    `flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors ${
      index === activeIndex ? "bg-white/10" : "hover:bg-white/10"
    }`;

  const groupHeader = (label: string) => (
    <div className="px-2.5 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
      {label}
    </div>
  );

  const hasResults =
    data !== null &&
    data.cards.length + data.pokemon.length + data.supply.length + data.users.length > 0;

  const dropdown = showDropdown ? (
    <div
      id="global-search-listbox"
      role="listbox"
      className="max-h-[min(70vh,480px)] overflow-y-auto rounded-xl bg-slate-900/95 p-1.5 shadow-xl ring-1 ring-white/15 backdrop-blur-sm"
    >
      {!hasResults && (
        <p className="px-2.5 py-3 text-sm text-slate-400">{t("noSuggestions")}</p>
      )}

      {data && data.cards.length > 0 && (
        <>
          {groupHeader(t("groupCards"))}
          {data.cards.map((card, i) => (
            <Link
              key={card.id}
              href={card.href}
              role="option"
              aria-selected={cardsStart + i === activeIndex}
              id={`gs-option-${cardsStart + i}`}
              onClick={(e) => {
                e.preventDefault();
                navigate(card.href);
              }}
              className={rowClass(cardsStart + i)}
            >
              <div className="h-11 w-8 shrink-0 overflow-hidden rounded-sm bg-slate-800">
                {card.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={card.imageUrl}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">{card.name}</p>
                <p className="truncate text-xs text-slate-400">
                  {card.setName} · #{card.localId}
                </p>
              </div>
              {card.price !== null && (
                <span className="shrink-0 text-sm font-semibold tabular-nums text-white">
                  €{card.price.toFixed(2)}
                </span>
              )}
            </Link>
          ))}
        </>
      )}

      {data && data.pokemon.length > 0 && (
        <>
          {groupHeader(t("groupPokemon"))}
          {data.pokemon.map((p, i) => (
            <Link
              key={p.dexId}
              href={p.href}
              role="option"
              aria-selected={pokemonStart + i === activeIndex}
              id={`gs-option-${pokemonStart + i}`}
              onClick={(e) => {
                e.preventDefault();
                navigate(p.href);
              }}
              className={rowClass(pokemonStart + i)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.spriteUrl}
                alt=""
                className="size-8 shrink-0 object-contain"
                loading="lazy"
              />
              <p className="min-w-0 flex-1 truncate text-sm font-medium text-white">
                {p.displayName}
              </p>
              <span className="shrink-0 font-mono text-xs text-slate-400">
                #{String(p.dexId).padStart(4, "0")}
              </span>
            </Link>
          ))}
        </>
      )}

      {data && data.supply.length > 0 && (
        <>
          {groupHeader(t("groupSupply"))}
          {data.supply.map((s, i) => {
            const TypeIcon = SUPPLY_ICONS[s.type];
            return (
              <Link
                key={`${s.type}-${s.id}`}
                href={s.href}
                role="option"
                aria-selected={supplyStart + i === activeIndex}
                id={`gs-option-${supplyStart + i}`}
                onClick={(e) => {
                  e.preventDefault();
                  navigate(s.href);
                }}
                className={rowClass(supplyStart + i)}
              >
                <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md bg-slate-800">
                  {s.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={s.imageUrl}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <TypeIcon className={`size-4 ${SUPPLY_COLORS[s.type]}`} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">{s.title}</p>
                  <p className={`truncate text-xs ${SUPPLY_COLORS[s.type]}`}>
                    {s.type === "auction"
                      ? t("typeAuction")
                      : s.type === "claimsale"
                        ? t("typeClaimsale")
                        : t("typeListing")}
                  </p>
                </div>
                {s.price !== null && (
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-white">
                    €{s.price.toFixed(2)}
                  </span>
                )}
              </Link>
            );
          })}
        </>
      )}

      {data && data.users.length > 0 && (
        <>
          {groupHeader(t("groupUsers"))}
          {data.users.map((u, i) => (
            <Link
              key={u.id}
              href={u.href}
              role="option"
              aria-selected={usersStart + i === activeIndex}
              id={`gs-option-${usersStart + i}`}
              onClick={(e) => {
                e.preventDefault();
                navigate(u.href);
              }}
              className={rowClass(usersStart + i)}
            >
              <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-800">
                {u.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={u.avatarUrl}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <UserIcon className="size-4 text-slate-400" />
                )}
              </div>
              <p className="min-w-0 flex-1 truncate text-sm font-medium text-white">
                {u.displayName}
              </p>
              {u.isVerified && <BadgeCheck className="size-4 shrink-0 text-sky-400" />}
            </Link>
          ))}
        </>
      )}

      {/* Footer: altijd naar de volledige resultatenpagina */}
      <div className="mt-1 border-t border-white/10 pt-1">
        <Link
          href={allHref}
          role="option"
          aria-selected={footerIndex === activeIndex}
          id={`gs-option-${footerIndex}`}
          onClick={(e) => {
            e.preventDefault();
            navigate(allHref);
          }}
          className={`${rowClass(footerIndex)} justify-between`}
        >
          <span className="text-sm font-medium text-primary">
            {t("allResultsFor", { query })}
          </span>
          <ArrowRight className="size-4 shrink-0 text-primary" />
        </Link>
      </div>
    </div>
  ) : null;

  const inputAria = {
    role: "combobox" as const,
    "aria-expanded": showDropdown,
    "aria-controls": "global-search-listbox",
    "aria-activedescendant": activeIndex >= 0 ? `gs-option-${activeIndex}` : undefined,
    "aria-autocomplete": "list" as const,
  };

  // ---------------------------------------------------------------------
  // Mobiel: full-width balk in het menu, dropdown eronder
  // ---------------------------------------------------------------------
  if (variant === "mobile") {
    return (
      <div ref={wrapperRef} className="relative">
        <form onSubmit={handleSubmit}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t("placeholder")}
              {...inputAria}
              className="w-full rounded-lg bg-white/10 py-2.5 pl-9 pr-3 text-base text-white placeholder:text-slate-400 focus:bg-white/15 focus:outline-none focus:ring-1 focus:ring-white/30"
            />
          </div>
        </form>
        {showDropdown && (
          <div className="absolute left-0 right-0 top-full z-50 mt-2">{dropdown}</div>
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------------
  // Desktop: loep-icoon dat naar links uitklapt, dropdown onder de balk
  // ---------------------------------------------------------------------
  return (
    <div ref={wrapperRef} className="relative hidden md:flex md:items-center">
      {/* Loep-trigger — verborgen zodra de balk open is */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("placeholder")}
        className={`rounded-md p-2 text-slate-300 transition-colors hover:bg-white/10 hover:text-white ${
          open ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
      >
        <Search className="h-5 w-5" />
      </button>

      {/* Uitklappende zoekbalk — geanimeerd naar links, over de nav heen */}
      <form
        onSubmit={handleSubmit}
        className={`absolute right-0 top-1/2 z-50 flex -translate-y-1/2 items-center overflow-hidden rounded-lg bg-slate-800/95 shadow-lg ring-1 ring-white/20 backdrop-blur-sm transition-all duration-300 ease-out ${
          open ? "w-[min(70vw,420px)] opacity-100" : "pointer-events-none w-0 opacity-0"
        }`}
      >
        <Search className="ml-3 h-4 w-4 shrink-0 text-slate-400" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t("placeholder")}
          tabIndex={open ? 0 : -1}
          {...inputAria}
          className="min-w-0 flex-1 bg-transparent px-2 py-2 text-base text-white placeholder:text-slate-400 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setValue("");
          }}
          tabIndex={open ? 0 : -1}
          aria-label="Sluit"
          className="mr-1 shrink-0 rounded-md p-1.5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </form>

      {/* Suggestie-dropdown onder de uitgeklapte balk */}
      {showDropdown && (
        <div className="absolute right-0 top-[calc(50%+1.5rem)] z-50 mt-1 w-[min(90vw,440px)]">
          {dropdown}
        </div>
      )}
    </div>
  );
}
