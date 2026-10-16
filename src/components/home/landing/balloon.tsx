"use client";

import { useId, type CSSProperties } from "react";
import { motion } from "framer-motion";

export type BalloonColor = "red" | "pink" | "yellow" | "blue" | "green";
export type BalloonShape = "cloud" | "flower" | "stack";

const PALETTE: Record<BalloonColor, { light: string; base: string; deep: string }> = {
  red: { light: "#ff8a93", base: "#f2202b", deep: "#8c1420" },
  pink: { light: "#ffe4ea", base: "#ffc4ce", deep: "#f08aa0" },
  yellow: { light: "#fffbc2", base: "#fff26b", deep: "#e3cf2a" },
  blue: { light: "#eaf2ff", base: "#c9dcff", deep: "#8fb0f0" },
  green: { light: "#eefcc8", base: "#d4f58f", deep: "#9fd24a" },
};

/**
 * Opgeblazen vorm in SVG (tijdelijke tegenhanger van de 3D-ballonnen in de
 * referentie). Drie vormen: wolk, bloem en gestapelde kussens. Later kan
 * hier een transparante video in de plaats komen zonder de secties te
 * veranderen: zelfde props, zelfde maat.
 */
export function Balloon({ color = "red", shape = "cloud", className = "", style }: { color?: BalloonColor; shape?: BalloonShape; className?: string; style?: CSSProperties }) {
  const id = useId().replace(/:/g, "");
  const p = PALETTE[color];
  const gradId = `g${id}`;
  const hiId = `h${id}`;
  const shId = `s${id}`;
  return (
    <svg viewBox="0 0 200 200" className={className} style={style} aria-hidden focusable="false">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={p.light} />
          <stop offset="0.55" stopColor={p.base} />
          <stop offset="1" stopColor={p.deep} />
        </linearGradient>
        <radialGradient id={hiId} cx="0.32" cy="0.25" r="0.55">
          <stop offset="0" stopColor="#fff" stopOpacity="0.85" />
          <stop offset="0.45" stopColor="#fff" stopOpacity="0.18" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <filter id={shId} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor={p.deep} floodOpacity="0.35" />
        </filter>
      </defs>
      <g filter={`url(#${shId})`}>
        <g fill={`url(#${gradId})`} stroke={p.deep} strokeOpacity="0.28" strokeWidth="1.5">
          {shape === "cloud" && (
            <>
              <circle cx="70" cy="80" r="46" />
              <circle cx="120" cy="66" r="52" />
              <circle cx="146" cy="118" r="42" />
              <circle cx="92" cy="134" r="50" />
              <circle cx="58" cy="118" r="34" />
            </>
          )}
          {shape === "flower" && (
            <>
              {[0, 60, 120, 180, 240, 300].map((a) => (
                <ellipse key={a} cx="100" cy="52" rx="26" ry="42" transform={`rotate(${a} 100 100)`} />
              ))}
              <circle cx="100" cy="100" r="40" />
            </>
          )}
          {shape === "stack" && (
            <>
              <rect x="42" y="26" width="116" height="56" rx="28" />
              <rect x="30" y="72" width="140" height="58" rx="29" />
              <rect x="44" y="120" width="112" height="54" rx="27" />
            </>
          )}
        </g>
        <g fill={`url(#${hiId})`}>
          {shape === "cloud" && <circle cx="100" cy="100" r="98" />}
          {shape === "flower" && <circle cx="100" cy="100" r="98" />}
          {shape === "stack" && <rect x="30" y="26" width="140" height="148" rx="40" />}
        </g>
      </g>
    </svg>
  );
}

/** Ballon die langzaam draait en zachtjes drijft (voor achter koppen en lijsten). */
export function FloatingBalloon({ color, shape, className = "", duration = 14 }: { color: BalloonColor; shape?: BalloonShape; className?: string; duration?: number }) {
  return (
    <motion.div
      className={className}
      animate={{ rotate: [0, 360] }}
      transition={{ duration: duration * 6, ease: "linear", repeat: Infinity }}
    >
      <motion.div
        animate={{ x: [0, 6, -4, 0], y: [0, -6, 5, 0] }}
        transition={{ duration, ease: "easeInOut", repeat: Infinity }}
        className="h-full w-full"
      >
        <Balloon color={color} shape={shape} className="h-full w-full" />
      </motion.div>
    </motion.div>
  );
}
