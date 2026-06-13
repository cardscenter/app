import { setRequestLocale } from "next-intl/server";
import { ShieldCheck } from "lucide-react";
import { ZDivider } from "@/components/home/z-divider";

/**
 * Tijdelijke testpagina voor de Z-divider. NIET voor productie — verwijderen
 * zodra de vorm op de homepage staat. Bereikbaar op /test-divider.
 *
 * Eén Z-vorm (de Beam-blade) op alle schermen.
 */
export default async function TestDividerPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="flex flex-col">
      <Label text="Donker → wit · 1 Z-vorm (Beam-blade)" />

      {/* Donkere sectie met de Z-divider eronder (gevuld met de witte kleur) */}
      <section className="bg-slate-900 text-white">
        <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-8 xl:px-10 pt-20 lg:pt-28 pb-10">
          <BandContent
            title="Z-divider"
            subtitle="Eén Z-vorm — de Beam-blade."
          />
        </div>
        <ZDivider fillClassName="text-card" height={28} />
      </section>
      <section className="bg-card py-20 lg:py-28">
        <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-8 xl:px-10">
          <h2 className="text-2xl font-bold">Witte sectie (bg-card)</h2>
          <p className="mt-2 text-muted-foreground">
            De blades van de sectie hierboven prikken hierin.
          </p>
        </div>
      </section>

      <Label text="Blauwe gradient → wit · 1 Z-vorm (Beam-blade)" />

      <section className="bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-600 text-white">
        <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-8 xl:px-10 pt-20 lg:pt-28 pb-10">
          <BandContent
            title="Z-divider — blauwe gradient"
            subtitle="Zelfde techniek in de merk-kleur."
          />
        </div>
        <ZDivider fillClassName="text-card" height={28} />
      </section>
      <section className="bg-card py-20 lg:py-28">
        <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-8 xl:px-10">
          <h2 className="text-2xl font-bold">Witte sectie (bg-card)</h2>
        </div>
      </section>
    </div>
  );
}

function Label({ text }: { text: string }) {
  return (
    <div className="bg-background">
      <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-8 xl:px-10 pt-10">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {text}
        </p>
      </div>
    </div>
  );
}

function BandContent({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <span className="inline-flex size-12 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/25">
        <ShieldCheck className="size-6" />
      </span>
      <h2 className="text-2xl font-bold sm:text-3xl">{title}</h2>
      <p className="max-w-xl text-sm opacity-90 sm:text-base">{subtitle}</p>
    </div>
  );
}
