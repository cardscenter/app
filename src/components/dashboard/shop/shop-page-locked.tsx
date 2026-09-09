"use client";

import { Link } from "@/i18n/navigation";
import { Lock, Zap, LayoutTemplate, Images, Star, Link2 } from "lucide-react";

/** Vergrendelde teaser van de winkelpagina-editor voor tiers zonder customProfile (patroon StatisticsLocked). */
export function ShopPageLocked() {
  const fake = [
    { icon: LayoutTemplate, label: "Over ons" },
    { icon: Images, label: "Fotogalerij" },
    { icon: Star, label: "Uitgelicht aanbod" },
    { icon: Link2, label: "Links & contact" },
  ];
  return (
    <div className="relative">
      <div className="pointer-events-none select-none blur-[6px]">
        <div className="space-y-4">
          <div className="dash-card h-40 bg-gradient-to-r from-primary/20 to-primary/5" />
          {fake.map(({ icon: Icon, label }) => (
            <div key={label} className="dash-card flex items-center gap-3 p-4">
              <div className="rounded-lg bg-primary/10 p-2">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-semibold">{label}</p>
                <div className="mt-2 h-3 w-2/3 rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="dash-card max-w-sm p-6 text-center shadow-lg">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Lock className="h-7 w-7 text-primary" />
          </div>
          <h3 className="mb-2 text-lg font-bold text-foreground">Winkelpagina is beschikbaar vanaf Unlimited</h3>
          <p className="mb-5 text-sm text-muted-foreground">
            Een eigen winkel-URL met banner, slogan en je eigen blokken (over ons, uitgelicht aanbod, links en — als
            bedrijf — een fotogalerij).
          </p>
          <Link
            href="/dashboard/abonnement"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
          >
            <Zap className="h-4 w-4" />
            Bekijk abonnementen
          </Link>
        </div>
      </div>
    </div>
  );
}
