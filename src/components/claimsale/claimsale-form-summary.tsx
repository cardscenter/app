"use client";

import { useTranslations } from "next-intl";
import { Clock, Image as ImageIcon, ListChecks } from "lucide-react";
import {
  deriveClaimsaleStartTime,
  isClaimsaleScheduled,
  formatNLDateTime,
} from "@/lib/claimsale/timing";
import type { ClaimsaleFormState } from "./wizard-types";

interface Props {
  form: ClaimsaleFormState;
}

function Row({
  label,
  children,
  muted,
}: {
  label: string;
  children: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-3 text-xs">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={muted ? "text-muted-foreground" : "font-medium text-foreground"}>{children}</dd>
    </div>
  );
}

export function ClaimsaleFormSummary({ form }: Props) {
  const t = useTranslations("claimsale");

  const startTime = deriveClaimsaleStartTime(form.startDate, form.startTimeOfDay);
  const scheduled = isClaimsaleScheduled(startTime);

  const prices = form.items
    .map((i) => parseFloat(i.price))
    .filter((p) => !Number.isNaN(p) && p > 0);
  const minPrice = prices.length > 0 ? Math.min(...prices) : null;
  const maxPrice = prices.length > 0 ? Math.max(...prices) : null;

  const priceRange =
    minPrice === null
      ? t("summaryNotFilled")
      : minPrice === maxPrice
        ? `€${minPrice.toFixed(2)}`
        : `€${minPrice!.toFixed(2)} – €${maxPrice!.toFixed(2)}`;

  return (
    <aside className="lg:sticky lg:top-20">
      <div className="mb-2 flex items-center gap-2">
        <ListChecks className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {t("summaryTitle")}
        </h3>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        <div className="relative aspect-square w-full bg-muted">
          {form.coverImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={form.coverImage} alt={form.title || "Thumbnail"} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <ImageIcon className="h-12 w-12 opacity-40" />
            </div>
          )}
          {scheduled && (
            <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-amber-500/95 px-2.5 py-1 text-[11px] font-medium text-white shadow">
              <Clock className="h-3 w-3" />
              {t("summaryScheduled")}
            </span>
          )}
        </div>

        <dl className="space-y-2.5 p-4">
          <Row label={t("summaryType")}>
            {form.type === "CARDS" ? t("typeCards") : t("typeItems")}
          </Row>
          <Row label={t("summaryTitleRow")} muted={!form.title}>
            {form.title || t("summaryNotFilled")}
          </Row>
          <div className="border-t border-border pt-2.5">
            <Row label={t("summaryItems")}>{form.items.length}</Row>
            <div className="mt-2.5">
              <Row label={t("summaryPriceRange")} muted={minPrice === null}>
                {priceRange}
              </Row>
            </div>
          </div>
          <div className="border-t border-border pt-2.5">
            <Row label={t("summaryStart")} muted={!scheduled}>
              {scheduled ? formatNLDateTime(startTime) : t("summaryInstant")}
            </Row>
          </div>
          {(form.upsells.length > 0 || form.labels.length > 0) && (
            <div className="border-t border-border pt-2.5">
              <Row label={t("summaryPromotions")}>
                {[
                  form.upsells.length > 0 ? `${form.upsells.length}× promotie` : null,
                  form.labels.length > 0 ? `${form.labels.length}× label` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Row>
            </div>
          )}
        </dl>
      </div>
    </aside>
  );
}
