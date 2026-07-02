"use client";

import { useEffect, useRef, useState } from "react";

// Pokémon- & TCG-weetjes om de wachttijd bij een cold load leuk te maken.
// Verzamelaar-gericht en (waar relevant) actueel — prijzen verouderen, dus
// periodiek bijwerken wanneer de markt flink beweegt.
const FACTS: string[] = [
  "In februari 2026 verkocht Logan Paul zijn Pikachu Illustrator (PSA 10) via Goldin voor $16,49 miljoen — de duurste handelskaart ooit geveild, met een Guinness-wereldrecord. Hij kocht 'm in 2021 nog voor “maar” $5,27 miljoen.",
  "Van de legendarische Pikachu Illustrator bestaan minder dan 40 exemplaren — een prijs voor winnaars van een illustratiewedstrijd in het Japanse CoroCoro-blad (1997-1998). Slechts één haalde de perfecte PSA 10.",
  "“Trophy Pikachu”-kaarten (No.1 / No.2 / No.3 Trainer) gingen alleen naar winnaars van officiële Japanse toernooien. Er bestaan er maar een handvol van, met verkopen tot ver in de zes cijfers.",
  "Echte fotokaarten uit de Pokémon Snap-wedstrijd (1999) bestaan: winnende kiekjes werden op kaart gedrukt en wisselen nu voor zes cijfers van eigenaar bij veilinghuizen.",
  "Een verzegelde 1e-editie Base Set-boosterbox uit 1999 is een investeringsobject geworden — complete dozen zijn voor honderdduizenden euro's geveild.",
  "2026 is het 30-jarig jubileum van de Pokémon TCG (de eerste set verscheen in 1996 in Japan) — TPCi viert dat met een speciale jubileum-uitgave later dit jaar.",
  "Het huidige tijdperk draait om Mega Evolution: in 2026 verschenen al Ascended Heroes, Perfect Order en Chaos Rising, met Pitch Black en de door Mega Rayquaza ex aangevoerde Storm Emerald nog op de planning.",
  "Mega-kaarten brachten een nieuw chase-formaat: de Mega-ex's in afwijkende alt-arts zijn meteen de meest gewilde pulls van hun set.",
  "De “Moonbreon” — de alt-art Umbreon VMAX uit Evolving Skies (2021) — groeide uit tot dé moderne chase-kaart; in PSA 10 wisselt 'ie nog steeds voor duizenden euro's van eigenaar.",
  "Umbreon is veruit de populairste Eeveelution: de Special Illustration Rare uit Prismatic Evolutions (2025) deed raw al snel honderden tot ruim duizend euro, en richting €3.000 in PSA 10.",
  "Surging Sparks (eind 2024) dankte z'n hype vooral aan de Special Illustration Rare van Tera Pikachu ex, die kort na release rond de €500 deed.",
  "De Japanse “Master Ball”-reverse-holo uit de 151-set (2023) heeft Poké Balls als foil-patroon over de hele kaart — een van de meest gehypte moderne pull-patronen ooit.",
  "De 151-set (2023) blies de originele 151 Pokémon nieuw leven in met kunst in de stijl van de allereerste Base Set — pure nostalgie als verkoopargument.",
  "Evolving Skies (2021) geldt voor velen als een van de mooiste moderne sets ooit, dankzij de alt-art Eeveelutions — de set bleef ná release nog jaren in waarde stijgen.",
  "“Alt arts” (full-arts met een verhalende achtergrond) zijn dé motor achter de moderne verzamelhype — ze zijn vaak zeldzamer dan de secret rares boven hen in de set.",
  "Toen het Van Gogh Museum in 2023 de speciale “Pikachu met grijze vilthoed”-promo uitdeelde, ontstond zo'n scalper-chaos dat het museum de kaart uit de winkel haalde — later kwam 'ie alsnog via Nederlandse retailers beschikbaar.",
  "Door de enorme vraag beperkten supermarkten en winkels de afgelopen jaren wereldwijd het aantal pakjes per klant — sommige ketens haalden ze tijdelijk uit de schappen om opstootjes te voorkomen.",
  "De Base Set-Charizard uit 1999 werd getekend door Mitsuhiro Arita — hij illustreerde later opnieuw Charizards en signeert tot op vandaag kaarten voor verzamelaars.",
  "Pikachu zelf is ontworpen door Atsuko Nishida; de allereerste ooit getekende Pokémon was echter Rhydon.",
  "“Shadowless” Base Set-kaarten komen uit de vroegste oplage en missen de slagschaduw naast de illustratie — flink zeldzamer (en duurder) dan de latere “unlimited”-druk.",
  "De reverse-holo-finish die we nu overal kennen werd pas in 2002 geïntroduceerd, met de Legendary Collection.",
  "Gold Star-kaarten uit het EX-tijdperk (2004-2007) tonen een Pokémon in afwijkende shiny-kleuren en waren de ultieme chase-pull — grofweg één per box.",
  "“Shining” Pokémon kwamen er eerder: Shining Gyarados en Shining Magikarp debuteerden in Neo Revelation (2001); de beroemde Shining Charizard volgde in Neo Destiny (2002).",
  "Crystal-type kaarten uit het e-Card-tijdperk (2002-2003) hadden een unieke dubbel-type-look en waren toen al ultra-zeldzame pulls.",
  "Espeon en Umbreon Gold Star (POP Series 5, 2007) zaten niet in gewone boosters, maar werden via georganiseerd spel uitgedeeld — vandaar hun hoge zeldzaamheid.",
  "De Ancient Mew-promo (bioscoop, 2000) is bedrukt met een fictief “Pokémon-schrift” en werd verzegeld uitgedeeld — veel exemplaren zijn daarom nog ongeopend.",
  "De Tamamushi University Magikarp-promo (1998) kreeg je alleen door een fictief “universiteitsexamen” te halen in een Japanse stripwedstrijd.",
  "Verzamelaars jagen op de “holo swirl”: het kosmos-foilpatroon van oude kaarten heeft een unieke draaikolk, en een mooi gecentreerde swirl kan de waarde flink opdrijven.",
  "“Secret rares” hebben een kaartnummer hoger dan het settotaal (bijv. 192/191) — vandaar dat ze “geheim” heten.",
  "Het kleine “Edition 1”-stempel linksonder kan zomaar een factor 10 in waarde schelen — verzamelaars betalen fors extra voor die eerste oplage.",
  "Foutdrukken zijn geld waard: miscuts, ontbrekende kleuren of een scheve holo-laag maken een verder gewone kaart ineens gewild bij fout-verzamelaars.",
  "Japanse kaarten zijn vaak beter gecentreerd en strakker gesneden dan hun Engelse tegenhangers — daarom mikken topgraders graag op de Japanse druk.",
  "Bij grading draait het niet alleen om het cijfer: centrering, scherpe hoeken en print-kwaliteit bepalen welke PSA 10 het méést waard is. Een centreer-fout van een paar millimeter scheelt zomaar het verschil tussen PSA 9 en 10 — en daarmee soms duizenden euro's.",
  "Grote veilinghuizen als Heritage, Goldin en Sotheby's veilen tegenwoordig serieus Pokémon-kaarten — een teken dat de hobby een volwassen investeringsmarkt is geworden.",
  "Pokémon TCG Pocket, de digitale kaart-app uit oktober 2024, werd razendsnel een van de best verdienende mobiele games — en bracht een nieuwe generatie naar het fysieke verzamelen.",
];

export function RouteLoadingIndicator() {
  // Zowel de balk als het percentage-getal animeren puur via CSS (zie
  // globals.css: .loading-bar-fill + .loading-pct-css) zodat ze ALTIJD lopen —
  // óók bij een cold load waar de loader vervangen wordt vóór de client-JS
  // hydrateert. Ná hydratie neemt de JS hieronder het getal over en
  // synchroniseert het met de balk z'n echte animatie-klok, zodat het getal de
  // balk volgt op alle browsers (Safari/Firefox animeren de CSS-counter niet).
  const [factIdx, setFactIdx] = useState(0);
  const [pct, setPct] = useState(4);
  const [hydrated, setHydrated] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  // Scroll naar boven zodra de loader verschijnt. De loader zit in een
  // min-h-[55vh]-box en kan anders onder beeld vallen als je al gescrold was
  // (elke loading.tsx-boundary remount 'm, dus dit vuurt op het juiste moment).
  useEffect(() => {
    requestAnimationFrame(() => window.scrollTo(0, 0));
  }, []);

  useEffect(() => {
    setFactIdx(Math.floor(Math.random() * FACTS.length)); // willekeurig startweetje
    const id = setInterval(() => {
      setFactIdx((i) => (i + 1) % FACTS.length);
    }, 4000);
    return () => clearInterval(id);
  }, []);

  // Na hydratie: neem het getal over en laat het 4% → 92% lopen, maar gekoppeld
  // aan de werkelijke verstreken tijd van de CSS-balk (Web Animations API) i.p.v.
  // een eigen klok. Zo springt het getal niet terug naar 4% als hydratie laat
  // komt bij een cold load — het pakt direct de stand van de balk op.
  useEffect(() => {
    setHydrated(true);
    const DURATION = 9000;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const anim = barRef.current?.getAnimations?.()[0];
      const ct = anim ? anim.currentTime : null;
      const elapsed = typeof ct === "number" ? ct : now - start;
      const t = Math.min(elapsed / DURATION, 1);
      // cubic-bezier(0.16, 0.8, 0.3, 1) benaderen met easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      setPct(Math.round(4 + eased * (92 - 4)));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="flex min-h-[55vh] flex-col items-center justify-center gap-5 px-6 text-center">
      {/* Plain <img> + unoptimized-equivalent: statisch bestand laadt direct,
          óók tijdens een cold render (de image-optimizer-route doet dat niet). */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/logo-loading.png"
        alt="Cards Center laadt"
        width={88}
        height={88}
        className="size-[88px] animate-spin [animation-duration:1.4s]"
      />

      {/* Vóór hydratie: CSS-counter (animeert zonder JS). Ná hydratie: JS-getal
          dat met de balk meeloopt. SSR rendert de !hydrated-tak → geen mismatch. */}
      {hydrated ? (
        <p className="text-xl font-bold tabular-nums text-foreground">{pct}%</p>
      ) : (
        <p
          aria-hidden
          className="loading-pct-css text-xl font-bold tabular-nums text-foreground"
        />
      )}

      <p className="-mt-3 text-xs text-muted-foreground">Meest actuele data laden…</p>

      <div className="h-1.5 w-56 overflow-hidden rounded-full bg-muted">
        <div ref={barRef} className="loading-bar-fill h-full rounded-full bg-primary" />
      </div>

      <div className="min-h-[3.5rem] max-w-sm">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-primary">
          Wist je dat?
        </p>
        <p key={factIdx} className="text-sm text-muted-foreground">
          {FACTS[factIdx]}
        </p>
      </div>
    </div>
  );
}
