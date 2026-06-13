"use client";

import { useEffect, useState } from "react";

// Pokémon- & TCG-weetjes om de wachttijd bij een cold load leuk te maken.
const FACTS: string[] = [
  "Pokémon betekent letterlijk “Pocket Monsters”.",
  "Rhydon was de allereerste Pokémon die ooit getekend werd.",
  "De duurste kaart ooit — de Pikachu Illustrator — ging voor ruim $5 miljoen van de hand.",
  "Eevee heeft de meeste evoluties van allemaal: maar liefst acht.",
  "De eerste Pokémon-kaartenset verscheen in 1996 in Japan.",
  "Pikachu's naam komt van “pika” (een vonkgeluid) en “chu” (een muisgeluid).",
  "Een 1e-editie Charizard uit 1999 is wel eens voor meer dan $400.000 verkocht.",
  "Ditto kan elke andere Pokémon nadoen — inclusief hun aanvallen.",
  "“Secret Rares” hebben een kaartnummer hoger dan het settotaal — vandaar hun naam.",
  "Magikarp lijkt nutteloos, maar evolueert naar de machtige Gyarados.",
  "Het holografische effect op kaarten maakt namaak een stuk lastiger.",
  "Verzamelaars noemen een complete set mét alle varianten een “master set”.",
  "Er bestaan inmiddels meer dan 1000 verschillende Pokémon-soorten.",
  "Charizard is al jaren een van de meest gewilde kaarten onder verzamelaars.",
];

export function RouteLoadingIndicator() {
  // De balk animeert puur via CSS (.loading-bar-fill in globals.css) zodat 'ie
  // ALTIJD loopt — ook vóór de JS gehydrateerd is. Het PERCENTAGE-getal is
  // JS-gedreven: de oude pure-CSS counter-truc (@property + counter()) werkt
  // alleen in Chromium, op iOS Safari/Firefox bleef 'ie op 0% hangen.
  const [factIdx, setFactIdx] = useState(0);
  const [pct, setPct] = useState(4);

  useEffect(() => {
    setFactIdx(Math.floor(Math.random() * FACTS.length)); // willekeurig startweetje
    const id = setInterval(() => {
      setFactIdx((i) => (i + 1) % FACTS.length);
    }, 4000);
    return () => clearInterval(id);
  }, []);

  // Tel 4% → 92% over ~9s met dezelfde easing als de CSS-balk, zodat getal en
  // balk synchroon lopen. Houdt daarna op 92% — 100% komt wanneer de pagina
  // geladen is en deze loader vervangt.
  useEffect(() => {
    const start = performance.now();
    const DURATION = 9000;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min((now - start) / DURATION, 1);
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

      <p className="text-xl font-bold tabular-nums text-foreground">{pct}%</p>

      <div className="h-1.5 w-56 overflow-hidden rounded-full bg-muted">
        <div className="loading-bar-fill h-full rounded-full bg-primary" />
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
