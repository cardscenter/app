import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { PackingInstructions } from "@/components/buyback/packing-instructions";

export const metadata: Metadata = {
  title: "Verpakkingsinstructies — Cards Center",
  description:
    "Stap-voor-stap uitleg over hoe je je bulk Pokémon-kaarten veilig verpakt en verzendt naar Cards Center, inclusief verzendadres en vervoerders-overzicht.",
};

export default function VerpakkenPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <Breadcrumbs
        items={[
          { label: "Verkoop calculator", href: "/verkoop-calculator" },
          { label: "Verpakkingsinstructies" },
        ]}
      />

      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Zo verpak je je bulk
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Volg dit stappenplan om er zeker van te zijn dat je kaarten veilig en in goede staat bij ons aankomen. Bewaar deze pagina &mdash; je kunt hem altijd terugvinden via je dashboard.
        </p>
      </header>

      <PackingInstructions />
    </div>
  );
}
