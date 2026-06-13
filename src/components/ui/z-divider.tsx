interface ZDividerProps {
  /**
   * Tailwind text-color class die de vulkleur bepaalt (fill="currentColor").
   * Zet dit op de achtergrondkleur van de sectie die ERONDER komt, bv.
   * "text-card", "text-background" of "text-slate-900".
   */
  fillClassName?: string;
  /** Hoogte van de divider-strook in px. Beam-original = 24. Default 44. */
  height?: number;
  /** Aantal Z-vormen op desktop (md en breder). Default 1. */
  desktopBlades?: number;
  /** Aantal Z-vormen op mobile (< md). Default 1. */
  mobileBlades?: number;
  /** Horizontaal spiegelen. Default false. */
  flipX?: boolean;
  /**
   * Overlap-modus: trek de divider met negatieve marge over de sectie erboven,
   * zodat de transparante delen de ECHTE content erboven tonen. Gebruik dit als
   * de bovenliggende sectie per pagina verschilt (zoals boven de footer). De
   * blade (fillClassName) is dan de kleur van de sectie ERONDER.
   */
  overlap?: boolean;
  className?: string;
}

/* ── Beam-blade geometrie (viewBox 0 0 1440 24) ──
   Eén blade = lange flauwe diagonaal naar een piek (y=0), dan een dun scherp
   kerfje dat terugslaat naar links-omlaag (y≈20). Coördinaten 1-op-1 uit Beam:
     1 blade  →  M1440 24V1.21274L668.015 20.1394L694.315 0L0 12.7714V24H1440Z
   We genereren hetzelfde patroon voor N blades. */
const VB_W = 1440;
const VB_H = 24;
const BLADE_OVERHANG = 26.3; // 694.315 - 668.015 (horizontale terugslag van het kerfje)
const BLADE_BASE_Y = 20.1394; // diepte van de kerf-basis
const EDGE_Y_LEFT = 12.7714; // y op de linkerrand
const EDGE_Y_RIGHT = 1.21274; // y op de rechterrand

function peaksFor(n: number): number[] {
  if (n <= 1) return [694.315]; // exact de Beam-piek
  return Array.from(
    { length: n },
    (_, i) => Math.round(((VB_W * (i + 1)) / (n + 1)) * 1000) / 1000
  );
}

function buildBladePath(numBlades: number): string {
  const peaks = peaksFor(numBlades);
  let d = `M${VB_W} ${VB_H}V${EDGE_Y_RIGHT}`;
  // Divider-lijn van rechts → links (zoals de Beam-path 'm aflegt).
  for (let i = peaks.length - 1; i >= 0; i--) {
    const peak = peaks[i];
    d += `L${round3(peak - BLADE_OVERHANG)} ${BLADE_BASE_Y}L${round3(peak)} 0`;
  }
  d += `L0 ${EDGE_Y_LEFT}V${VB_H}H${VB_W}Z`;
  return d;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function Svg({
  blades,
  fillClassName,
  height,
  flipX,
  responsiveClass,
}: {
  blades: number;
  fillClassName: string;
  height: number;
  flipX: boolean;
  responsiveClass: string;
}) {
  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      preserveAspectRatio="none"
      width="100%"
      height={height}
      aria-hidden="true"
      className={`${fillClassName} ${responsiveClass}`}
      style={{ display: "block" }}
    >
      <path
        d={buildBladePath(blades)}
        fill="currentColor"
        transform={flipX ? `translate(${VB_W},0) scale(-1,1)` : undefined}
      />
    </svg>
  );
}

/**
 * Z-divider — de Beam "blade"-divider als SVG-path (geen clip-path).
 *
 * Standaard 1 Z-vorm (exact de Beam-blade) op alle schermen. Wil je responsive
 * variëren, zet dan `desktopBlades` en `mobileBlades` verschillend; dan rendert
 * de component twee SVG's met md-breakpoint. Plaats deze als LAATSTE kind binnen
 * de bovenste sectie; vul 'm met de kleur van de ONDERSTE sectie via
 * `fillClassName`.
 */
export function ZDivider({
  fillClassName = "text-card",
  height = 44,
  desktopBlades = 1,
  mobileBlades = 1,
  flipX = false,
  overlap = false,
  className = "",
}: ZDividerProps) {
  const style = overlap
    ? { marginTop: `-${height}px`, position: "relative" as const, zIndex: 1 }
    : undefined;

  // Gelijk aantal blades → één SVG (geen onnodige responsive-splitsing).
  if (desktopBlades === mobileBlades) {
    return (
      <div className={className} style={style}>
        <Svg
          blades={desktopBlades}
          fillClassName={fillClassName}
          height={height}
          flipX={flipX}
          responsiveClass="block"
        />
      </div>
    );
  }

  return (
    <div className={className} style={style}>
      <Svg
        blades={mobileBlades}
        fillClassName={fillClassName}
        height={height}
        flipX={flipX}
        responsiveClass="block md:hidden"
      />
      <Svg
        blades={desktopBlades}
        fillClassName={fillClassName}
        height={height}
        flipX={flipX}
        responsiveClass="hidden md:block"
      />
    </div>
  );
}
