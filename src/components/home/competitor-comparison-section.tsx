import { Fragment } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import {
  Check,
  X,
  Minus,
  CircleDashed,
  Coins,
  ShieldCheck,
  Layers,
  HeadphonesIcon,
  Trophy,
} from "lucide-react";
import { AnimatedSection } from "@/components/home/animated-section";
import {
  COMPETITORS,
  DIMENSIONS,
  COMPETITOR_DATA_AS_OF_NL,
  COMPETITOR_DATA_AS_OF_EN,
  type CellStatus,
  type DimensionKey,
  type CompetitorCell,
} from "@/lib/competitor-data";

const DIMENSION_ICONS: Record<DimensionKey, typeof Coins> = {
  fees: Coins,
  trust: ShieldCheck,
  tcg: Layers,
  service: HeadphonesIcon,
};

const STATUS_ICON: Record<
  CellStatus,
  { Icon: typeof Check; iconClass: string }
> = {
  yes: { Icon: Check, iconClass: "text-emerald-600 dark:text-emerald-400" },
  no: { Icon: X, iconClass: "text-muted-foreground/40" },
  partial: { Icon: CircleDashed, iconClass: "text-amber-600 dark:text-amber-400" },
  na: { Icon: Minus, iconClass: "text-muted-foreground/40" },
};

interface CompetitorComparisonSectionProps {
  bgClass?: string;
  locale: string;
}

/**
 * Desktop-only competitor comparison table.
 *
 * Hidden on viewports < md (768px) via `hidden md:block`. There's no mobile
 * variant — by design. Mobile users skip this section entirely (decision
 * captured in user feedback on 2026-05-12 after a hybrid layout caused
 * layout issues that were not worth solving for the conversion gain).
 *
 * Layout: `table-fixed` + `w-1/6` per column-header gives all 6 columns
 * equal width. Cards Center column gets a subtle emerald tint to draw
 * the eye.
 */
export function CompetitorComparisonSection({
  bgClass = "bg-background",
  locale,
}: CompetitorComparisonSectionProps) {
  const t = useTranslations("home");
  const asOfDate = locale === "en" ? COMPETITOR_DATA_AS_OF_EN : COMPETITOR_DATA_AS_OF_NL;

  return (
    <section className={`hidden py-16 md:block lg:py-24 ${bgClass}`}>
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
        <AnimatedSection>
          {/* Header */}
          <div className="mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30">
              <Trophy className="size-3" />
              {t("competitorComparisonEyebrow")}
            </div>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              {t("competitorComparisonTitle")}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              {t("competitorComparisonSubtitle")}
            </p>
          </div>

          {/* Comparison table */}
          <div className="mt-10 overflow-hidden rounded-2xl border border-border bg-card shadow-card">
            <table className="w-full table-fixed border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-muted">
                  <th
                    scope="col"
                    className="w-1/6 px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground"
                  >
                    {t("competitorTableRowHeader")}
                  </th>
                  {COMPETITORS.map((c) => (
                    <th
                      key={c.key}
                      scope="col"
                      className={`w-1/6 px-3 py-3 text-center text-xs font-bold uppercase tracking-wider ${
                        c.isUs
                          ? "bg-emerald-50/60 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                          : "text-muted-foreground"
                      }`}
                    >
                      {c.isUs ? (
                        <span className="inline-flex items-center justify-center">
                          <Image
                            src="/images/logo-white-bg.png"
                            alt="Cards Center"
                            width={143}
                            height={40}
                            className="h-10 w-auto dark:hidden"
                          />
                          <Image
                            src="/images/logo-dark-mode.png"
                            alt="Cards Center"
                            width={143}
                            height={40}
                            className="hidden h-10 w-auto dark:block"
                          />
                        </span>
                      ) : (
                        c.displayName
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DIMENSIONS.map((dim) => {
                  const Icon = DIMENSION_ICONS[dim.key];
                  return (
                    <Fragment key={dim.key}>
                      {/* Section header row */}
                      <tr className="border-y border-border bg-muted/70">
                        <th
                          scope="row"
                          colSpan={COMPETITORS.length + 1}
                          className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-foreground"
                        >
                          <span className="inline-flex items-center gap-1.5">
                            <Icon className="size-3.5" />
                            {t(`competitorComparisonDim${capitalize(dim.key)}Title`)}
                          </span>
                        </th>
                      </tr>

                      {/* Data rows */}
                      {dim.rowKeys.map((rowKey, rowIdx) => (
                        <tr
                          key={rowKey}
                          className={
                            rowIdx < dim.rowKeys.length - 1
                              ? "border-b border-border/60"
                              : ""
                          }
                        >
                          <th
                            scope="row"
                            className="px-4 py-2.5 text-left text-sm font-medium text-foreground"
                          >
                            {t(`competitorRow${capitalize(rowKey)}`)}
                          </th>
                          {COMPETITORS.map((c) => (
                            <td
                              key={c.key}
                              className={`px-3 py-2.5 text-center align-middle ${
                                c.isUs
                                  ? "bg-emerald-50/60 dark:bg-emerald-500/[0.06]"
                                  : ""
                              }`}
                            >
                              <Cell
                                cell={c.cells[dim.key][rowIdx]}
                                displayMode={dim.displayMode}
                                t={t}
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Disclaimer-footnote */}
          <p className="mx-auto mt-6 max-w-3xl text-center text-xs text-muted-foreground">
            {t("competitorComparisonFootnote", { date: asOfDate })}
          </p>
        </AnimatedSection>
      </div>
    </section>
  );
}

/* ── Single cell ── */

function Cell({
  cell,
  displayMode,
  t,
}: {
  cell: CompetitorCell;
  displayMode: "value" | "feature";
  t: ReturnType<typeof useTranslations>;
}) {
  // For fee dimensions: show the value or labelKey text.
  if (displayMode === "value") {
    const text = cell.value ?? (cell.labelKey ? t(cell.labelKey) : "—");
    const muted =
      cell.status === "na" ? "text-muted-foreground/60" : "text-foreground";
    return <span className={`text-xs font-semibold ${muted}`}>{text}</span>;
  }

  // For feature dimensions: icon + optional label below
  const { Icon, iconClass } = STATUS_ICON[cell.status];
  const label = cell.labelKey ? t(cell.labelKey) : null;
  const srOnly =
    cell.status === "yes"
      ? t("competitorCellYes")
      : cell.status === "no"
        ? t("competitorCellNo")
        : cell.status === "partial"
          ? t("competitorCellPartial")
          : t("competitorCellNa");

  return (
    <span className="inline-flex flex-col items-center gap-0.5">
      <Icon className={`size-4 ${iconClass}`} aria-hidden />
      {label ? (
        <span className="text-[10px] leading-tight text-muted-foreground">
          {label}
        </span>
      ) : (
        <span className="sr-only">{srOnly}</span>
      )}
    </span>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
