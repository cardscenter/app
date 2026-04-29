"use client";

import { useTranslations } from "next-intl";
import { CancellationActions } from "./cancellation-actions";

interface BundleStub {
  id: string;
  orderNumber: string;
  status: string;
  totalCost: number;
  counterpartyName: string;
}

interface CancellationsSectionProps {
  currentUserId: string;
  paidBundles: BundleStub[];
}

export function CancellationsSection({ currentUserId, paidBundles }: CancellationsSectionProps) {
  const t = useTranslations("cancellation");

  if (paidBundles.length === 0) return null;

  return (
    <section className="glass rounded-xl p-5">
      <h2 className="text-lg font-semibold text-foreground">{t("sectionTitle")}</h2>
      <p className="mt-1 text-xs text-muted-foreground">{t("sectionHelp")}</p>

      <ul className="mt-4 space-y-4">
        {paidBundles.map((b) => (
          <li
            key={b.id}
            className="rounded-lg border border-border bg-white/40 p-3 text-sm dark:bg-white/5"
          >
            <div className="mb-2 flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">
                  {b.orderNumber} — €{b.totalCost.toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground">{b.counterpartyName}</p>
              </div>
            </div>
            <CancellationActions
              bundleId={b.id}
              currentUserId={currentUserId}
              bundleStatus={b.status}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
