// Trend-fit helpers — gedeeld door de kaart-detailgrafiek (client) en de
// /kaarten stijgers/dalers-berekening (server).
//
// Waarom trend-gebaseerde percentages: een delta van twee losse snapshots
// (vandaag vs. exact ~7 dagen terug) is gevoelig voor een toevallige piek of
// dip op precies die dag — dat gaf absurde percentages. De kleinste-kwadraten-
// trendlijn gebruikt ALLE punten in het venster, dus begin→eind van de fit is
// een veel robuustere maat voor de werkelijke beweging.

interface QuadFit {
  a: number;
  b: number;
  c: number;
}

/** Kwadratische kleinste-kwadraten-fit op willekeurige (x, y)-paren. */
function fitQuad(xs: number[], ys: number[]): QuadFit | null {
  const n = xs.length;
  if (n < 5) return null;
  let s1 = 0, s2 = 0, s3 = 0, s4 = 0, t0 = 0, t1 = 0, t2 = 0;
  for (let i = 0; i < n; i++) {
    const x = xs[i], y = ys[i];
    s1 += x; s2 += x * x; s3 += x * x * x; s4 += x * x * x * x;
    t0 += y; t1 += x * y; t2 += x * x * y;
  }
  const det3 = (m: number[][]) =>
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
    m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
    m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const D = det3([[n, s1, s2], [s1, s2, s3], [s2, s3, s4]]);
  if (Math.abs(D) < 1e-12) return null;
  return {
    a: det3([[t0, s1, s2], [t1, s2, s3], [t2, s3, s4]]) / D,
    b: det3([[n, t0, s2], [s1, t1, s3], [s2, t2, s4]]) / D,
    c: det3([[n, s1, t0], [s1, s2, t1], [s2, s3, t2]]) / D,
  };
}

const evalQuad = (f: QuadFit, x: number) => f.a + f.b * x + f.c * x * x;

const median = (sortedAsc: number[]) => {
  const mid = Math.floor(sortedAsc.length / 2);
  return sortedAsc.length % 2 === 0
    ? (sortedAsc[mid - 1] + sortedAsc[mid]) / 2
    : sortedAsc[mid];
};

/**
 * Theil-Sen basislijn: mediaan van alle paarsgewijze hellingen + mediaan-
 * intercept. Extreem robuust — een enkele glitch-dag verschuift de mediaan
 * nauwelijks, ook niet op een venstergrens (waar een kleinste-kwadraten-fit
 * juist de meeste leverage heeft). Alleen gebruikt voor uitschieter-DETECTIE;
 * de getekende lijn blijft de kwadratische fit.
 */
function theilSenBaseline(xs: number[], ys: number[]): { b0: number; b1: number } {
  const slopes: number[] = [];
  for (let i = 0; i < xs.length; i++) {
    for (let j = i + 1; j < xs.length; j++) {
      if (xs[j] !== xs[i]) slopes.push((ys[j] - ys[i]) / (xs[j] - xs[i]));
    }
  }
  const b1 = slopes.length > 0 ? median(slopes.sort((a, b) => a - b)) : 0;
  const intercepts = ys.map((y, i) => y - b1 * xs[i]).sort((a, b) => a - b);
  return { b0: median(intercepts), b1 };
}

/**
 * Kwadratische trendlijn (a + b·x + c·x²) over de reeks — een stijve, licht
 * buigende lijn van begin tot eind. Bewust maar 3 vrijheidsgraden zodat 'ie
 * de ruis niet volgt.
 *
 * Robuust tegen losse glitch-dagen: punten die > 2.5σ (MAD-gebaseerd) van de
 * Theil-Sen-basislijn af liggen worden weggelaten (max ~20% van de punten)
 * vóór de kwadratische fit. Eén piek- of dipdag — óók op een venstergrens —
 * trekt de lijn dan niet meer scheef, terwijl een echte gestage stijging of
 * daling volledig behouden blijft. Null bij te weinig punten (<5) of een
 * numeriek ontaarde fit.
 */
export function quadraticTrend(values: number[], times?: number[]): number[] | null {
  const n = values.length;
  if (n < 5) return null;
  // x genormaliseerd naar [0,1] voor numerieke stabiliteit. Met `times`
  // (timestamps, zelfde lengte) wordt de ECHTE tijdsafstand tussen punten
  // gebruikt — cruciaal wanneer er gaten in de snapshot-reeks zitten
  // (gemiste sync-nachten): index-gebaseerde x doet alsof 4 dagen gat niet
  // bestaat en vertekent de fit.
  let xs: number[];
  if (times && times.length === n && times[n - 1] > times[0]) {
    const t0 = times[0];
    const span = times[n - 1] - t0;
    xs = times.map((t) => (t - t0) / span);
  } else {
    xs = values.map((_, i) => i / (n - 1));
  }

  // Uitschieter-detectie tegen de robuuste basislijn
  const base = theilSenBaseline(xs, values);
  const resid = values.map((y, i) => y - (base.b0 + base.b1 * xs[i]));
  const absSorted = resid.map(Math.abs).sort((a, b) => a - b);
  const sigma = 1.4826 * median(absSorted); // MAD → robuuste sigma-schatting
  const threshold = Math.max(2.5 * sigma, 1e-9);
  const maxDrop = Math.min(Math.floor(n * 0.2), n - 5);
  let keepX = xs;
  let keepY = values;
  if (maxDrop > 0) {
    const flagged = resid
      .map((r, i) => ({ i, ar: Math.abs(r) }))
      .filter((o) => o.ar > threshold)
      .sort((a, b) => b.ar - a.ar)
      .slice(0, maxDrop);
    if (flagged.length > 0) {
      const drop = new Set(flagged.map((o) => o.i));
      keepX = xs.filter((_, i) => !drop.has(i));
      keepY = values.filter((_, i) => !drop.has(i));
    }
  }

  const fit = fitQuad(keepX, keepY) ?? fitQuad(xs, values);
  if (!fit) return null;
  return xs.map((x) => evalQuad(fit, x));
}

/**
 * Percentage-verschil tussen begin en eind van de trendlijn over `values`.
 * Null bij te weinig punten of wanneer het startpunt van de fit niet
 * positief is (dan is een percentage betekenisloos).
 */
export function trendDeltaPct(values: number[], times?: number[]): number | null {
  const trend = quadraticTrend(values, times);
  if (!trend) return null;
  const first = trend[0];
  const last = trend[trend.length - 1];
  if (!(first > 0)) return null;
  return ((last - first) / first) * 100;
}
