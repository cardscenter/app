"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

// Pokémon- & TCG-weetjes om de wachttijd bij een cold load leuk te maken.
// Nederlands, kort genoeg om in één oogopslag te lezen.
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
  const [pct, setPct] = useState(6);
  const [factIdx, setFactIdx] = useState(0);

  // Willekeurig startweetje (client-side, dus Math.random mag hier).
  useEffect(() => {
    setFactIdx(Math.floor(Math.random() * FACTS.length));
  }, []);

  // Indicatief percentage: snel omhoog, daarna afremmend richting 95% (we
  // weten de echte SSR-voortgang niet — 100% komt vanzelf als de pagina laadt
  // en deze loader vervangt).
  useEffect(() => {
    const id = setInterval(() => {
      setPct((cur) => (cur >= 95 ? 95 : Math.min(95, cur + Math.max(1, Math.round((95 - cur) * 0.08)))));
    }, 220);
    return () => clearInterval(id);
  }, []);

  // Roteer de weetjes zodat er bij een langere wachttijd steeds iets nieuws staat.
  useEffect(() => {
    const id = setInterval(() => {
      setFactIdx((i) => (i + 1) % FACTS.length);
    }, 4000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex min-h-[55vh] flex-col items-center justify-center gap-5 px-6 text-center">
      <Image
        src="/images/logo-loading.png"
        alt="Cards Center laadt"
        width={88}
        height={88}
        priority
        className="animate-spin [animation-duration:1.4s]"
      />
      <p className="text-xl font-bold tabular-nums text-foreground">{pct}%</p>
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
