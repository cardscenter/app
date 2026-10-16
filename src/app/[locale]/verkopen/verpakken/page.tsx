import type { Metadata } from "next";
import { PackingInstructions } from "@/components/buyback/packing-instructions";
import { CenteredHero } from "@/components/ploy/centered-hero";
import { CtaButton } from "@/components/ploy/cta-button";
import { ClosingCta } from "@/components/ploy/closing-cta";

export const metadata: Metadata = {
  title: "Verpakkingsinstructies — Cards Center",
  description: "Stap-voor-stap uitleg over hoe je je bulk Pokémon-kaarten veilig verpakt en verzendt naar Cards Center, inclusief verzendadres en vervoerders-overzicht.",
};

/** Verpakinstructies (design-pass Fase D): hero, adreskaarten, verhaalrijen, tips, vervoerders, waarschuwingen, slot. Hardcoded NL. */
export default function VerpakkenPage() {
  return (
    <div className="cc-landing overflow-clip">
      <CenteredHero title="Zo verpak je je bulk" highlightWord="bulk" highlightColor="yellow" description="Volg dit stappenplan en je kaarten komen veilig en in goede staat bij ons aan. Je vindt deze pagina altijd terug via je dashboard.">
        <CtaButton href="/verkopen/bulk" variant="red">
          Naar de bulk-calculator
        </CtaButton>
        <CtaButton href="/verkopen" variant="light">
          Alles over verkopen
        </CtaButton>
      </CenteredHero>
      <PackingInstructions />
      <ClosingCta color="blue" title="Doos dicht? Dan is het aan ons" text="Zodra je pakket binnen is, tellen we alles na en zie je de definitieve berekening in je dashboard.">
        <CtaButton href="/dashboard/inkoop" variant="red">
          Mijn inkoopaanvragen
        </CtaButton>
        <CtaButton href="/verkopen" variant="light">
          Terug naar verkopen
        </CtaButton>
      </ClosingCta>
    </div>
  );
}
