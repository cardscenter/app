"use client";

import { useState } from "react";
import type { MenuItemView } from "@/lib/food/menu-server";

/** SVG-illustraties uit het prototype (fallback als er geen foto is). */
export function ArtSvg({ art, color }: { art: string; color?: string | null }) {
  const c = color ?? "#8E8A90";
  switch (art) {
    case "burger":
      return (
        <svg viewBox="0 0 64 64" className="h-full w-full">
          <path d="M10 29c0-10.5 10-17 22-17s22 6.5 22 17z" fill="#E8A044" />
          <g fill="#FFF3D6"><ellipse cx="24" cy="19" rx="1.6" ry="1" /><ellipse cx="33" cy="16.5" rx="1.6" ry="1" /><ellipse cx="41" cy="20" rx="1.6" ry="1" /><ellipse cx="29" cy="23" rx="1.6" ry="1" /><ellipse cx="38" cy="24.5" rx="1.6" ry="1" /></g>
          <path d="M8 30h48l-2.5 4-3.5-2.5-3.5 2.5-3.5-2.5-3.5 2.5-3.5-2.5L32 34l-3.5-2.5-3.5 2.5-3.5-2.5-3.5 2.5-3.5-2.5-3.5 2.5z" fill="#5AA83C" />
          <path d="M10 34h44l-7 6-4-3-6 4z" fill="#F6C437" />
          <rect x="9" y="36" width="46" height="9" rx="4.5" fill="#6A3820" />
          <path d="M11 47h42v2.5a4.5 4.5 0 0 1-4.5 4.5h-33A4.5 4.5 0 0 1 11 49.5z" fill="#D88A34" />
        </svg>
      );
    case "fries":
      return (
        <svg viewBox="0 0 64 64" className="h-full w-full">
          <g fill="#F3C33F" stroke="#E0A92A" strokeWidth=".8"><rect x="19" y="9" width="5" height="26" rx="1.5" transform="rotate(-9 21 22)" /><rect x="25" y="6" width="5" height="28" rx="1.5" transform="rotate(-3 27 20)" /><rect x="31" y="7" width="5" height="27" rx="1.5" transform="rotate(4 33 20)" /><rect x="37" y="9" width="5" height="25" rx="1.5" transform="rotate(10 39 22)" /><rect x="28" y="12" width="5" height="22" rx="1.5" transform="rotate(14 30 23)" /></g>
          <path d="M14 27h36l-4.5 29h-27z" fill="#D51C26" /><path d="M14 27h36l-.8 5H14.8z" fill="#9E1520" /><circle cx="32" cy="43" r="6" fill="#fff" /><path d="M30 39.5l-1.5 4h2.2l-1.2 4 4-5.2h-2.3l1.4-2.8z" fill="#D51C26" />
        </svg>
      );
    case "loaded":
      return (
        <svg viewBox="0 0 64 64" className="h-full w-full">
          <g fill="#F3C33F"><rect x="12" y="24" width="18" height="5" rx="2" transform="rotate(-12 21 26)" /><rect x="26" y="20" width="18" height="5" rx="2" transform="rotate(8 35 22)" /><rect x="34" y="26" width="18" height="5" rx="2" transform="rotate(-6 43 28)" /><rect x="18" y="30" width="20" height="5" rx="2" transform="rotate(5 28 32)" /></g>
          <path d="M16 27c4-3 8 1 12-2s7 1 10-1 6 2 10 0" stroke="#8A4A2A" strokeWidth="4" fill="none" strokeLinecap="round" />
          <path d="M17 31l4-2 4 2 4-2 4 2 4-2 4 2 4-2 4 2" stroke="#FFF7E6" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <g fill="#63B33F"><circle cx="22" cy="24" r="1.4" /><circle cx="30" cy="22" r="1.4" /><circle cx="39" cy="25" r="1.4" /><circle cx="46" cy="28" r="1.4" /><circle cx="26" cy="29" r="1.4" /></g>
          <path d="M7 34h50l-5 18a3 3 0 0 1-3 2H15a3 3 0 0 1-3-2z" fill="#26262A" /><path d="M7 34h50" stroke="#3B3B40" strokeWidth="3" />
        </svg>
      );
    case "nuggets":
      return (
        <svg viewBox="0 0 64 64" className="h-full w-full">
          <ellipse cx="32" cy="48" rx="24" ry="6" fill="#fff" stroke="#E7DCD8" />
          <g fill="#D9932E" stroke="#B9741C" strokeWidth="1"><path d="M14 38c0-6 6-9 11-8s7 6 4 10-15 4-15-2z" /><path d="M30 34c1-6 9-8 13-5s3 9-2 11-12 0-11-6z" /><path d="M22 44c0-5 7-7 11-5s4 7 0 9-11 1-11-4z" /><path d="M38 44c1-4 7-6 10-3s1 8-3 8-7-1-7-5z" /></g>
          <circle cx="49" cy="27" r="7" fill="#fff" stroke="#E7DCD8" /><circle cx="49" cy="27" r="5" fill="#E8483E" />
        </svg>
      );
    case "sticks":
      return (
        <svg viewBox="0 0 64 64" className="h-full w-full">
          <ellipse cx="32" cy="48" rx="24" ry="6" fill="#fff" stroke="#E7DCD8" />
          <g fill="#E0A23A" stroke="#BE7F1F" strokeWidth="1"><rect x="12" y="34" width="30" height="7" rx="3.5" transform="rotate(-18 27 37)" /><rect x="18" y="38" width="30" height="7" rx="3.5" transform="rotate(-8 33 41)" /><rect x="22" y="42" width="30" height="7" rx="3.5" transform="rotate(4 37 45)" /></g>
          <circle cx="50" cy="24" r="6.5" fill="#fff" stroke="#E7DCD8" /><circle cx="50" cy="24" r="4.5" fill="#C9302C" />
        </svg>
      );
    case "balls":
      return (
        <svg viewBox="0 0 64 64" className="h-full w-full">
          <ellipse cx="32" cy="48" rx="24" ry="6" fill="#fff" stroke="#E7DCD8" />
          <g fill="#B8702A" stroke="#93561C" strokeWidth="1"><circle cx="20" cy="40" r="6.5" /><circle cx="33" cy="42" r="6.5" /><circle cx="45" cy="39" r="6.5" /><circle cx="26" cy="31" r="6.5" /><circle cx="39" cy="30" r="6.5" /></g>
          <g fill="#D8944A"><circle cx="18" cy="38" r="1.5" /><circle cx="31" cy="40" r="1.5" /><circle cx="43" cy="37" r="1.5" /><circle cx="24" cy="29" r="1.5" /><circle cx="37" cy="28" r="1.5" /></g>
          <circle cx="50" cy="20" r="6" fill="#fff" stroke="#E7DCD8" /><circle cx="50" cy="20" r="4" fill="#E9B730" />
        </svg>
      );
    case "rolls":
      return (
        <svg viewBox="0 0 64 64" className="h-full w-full">
          <ellipse cx="32" cy="48" rx="24" ry="6" fill="#fff" stroke="#E7DCD8" />
          <g fill="#E7B04B" stroke="#C48A26" strokeWidth="1"><rect x="10" y="34" width="26" height="9" rx="4.5" transform="rotate(-25 23 38)" /><rect x="22" y="36" width="26" height="9" rx="4.5" transform="rotate(-25 35 40)" /><rect x="32" y="38" width="22" height="9" rx="4.5" transform="rotate(-25 43 42)" /></g>
          <circle cx="50" cy="22" r="6.5" fill="#fff" stroke="#E7DCD8" /><circle cx="50" cy="22" r="4.5" fill="#F05A3A" />
        </svg>
      );
    case "box":
      return (
        <svg viewBox="0 0 64 64" className="h-full w-full">
          <g fill="#F3C33F"><rect x="13" y="16" width="4" height="18" rx="1.2" transform="rotate(-10 15 25)" /><rect x="18" y="14" width="4" height="20" rx="1.2" transform="rotate(-2 20 24)" /></g>
          <g fill="#B8702A"><circle cx="31" cy="27" r="5" /><circle cx="39" cy="29" r="5" /></g>
          <rect x="44" y="18" width="7" height="18" rx="3.5" fill="#E0A23A" transform="rotate(15 47 27)" /><path d="M26 30c2-5 9-5 9 0" fill="#D9932E" />
          <path d="M8 30h48v20a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4z" fill="#D51C26" /><path d="M8 30h48l-4-6H12z" fill="#9E1520" />
          <rect x="18" y="38" width="28" height="9" rx="2" fill="#fff" /><path d="M22 42.5h20" stroke="#D51C26" strokeWidth="2.4" strokeLinecap="round" strokeDasharray="3 3" />
        </svg>
      );
    case "bottle":
      return (
        <svg viewBox="0 0 64 64" className="h-full w-full">
          <ellipse cx="32" cy="56" rx="11" ry="2.6" fill="rgba(0,0,0,.08)" /><rect x="28" y="6" width="8" height="6" rx="1.5" fill="#2A2A2E" />
          <path d="M28 12h8v5c4 3 7 6 7 11v24a4 4 0 0 1-4 4H25a4 4 0 0 1-4-4V28c0-5 3-8 7-11z" fill={c} opacity=".88" />
          <rect x="21" y="32" width="22" height="13" fill="#fff" /><rect x="24" y="36" width="16" height="2.4" rx="1.2" fill={c} /><rect x="24" y="22" width="3" height="8" rx="1.5" fill="rgba(255,255,255,.4)" />
        </svg>
      );
    case "dip":
      return (
        <svg viewBox="0 0 64 64" className="h-full w-full">
          <ellipse cx="32" cy="44" rx="20" ry="7" fill="rgba(0,0,0,.06)" />
          <path d="M12 30h40l-4 14a4 4 0 0 1-4 3H20a4 4 0 0 1-4-3z" fill="#fff" stroke="#E2DADA" strokeWidth="1.5" />
          <ellipse cx="32" cy="30" rx="20" ry="6" fill="#fff" stroke="#E2DADA" strokeWidth="1.5" /><ellipse cx="32" cy="30.5" rx="16" ry="4" fill={c} />
        </svg>
      );
    case "can":
    default:
      return (
        <svg viewBox="0 0 64 64" className="h-full w-full">
          <ellipse cx="32" cy="55" rx="13" ry="3" fill="rgba(0,0,0,.08)" /><rect x="20" y="10" width="24" height="45" rx="4" fill={c} />
          <rect x="20" y="10" width="24" height="5" rx="2.5" fill="#C9C7CC" /><rect x="21" y="51" width="22" height="4" rx="2" fill="#B9B7BC" />
          <rect x="24" y="16" width="4" height="34" rx="2" fill="rgba(255,255,255,.28)" /><path d="M20 27c8 4 16-4 24 0v9c-8-4-16 4-24 0z" fill="rgba(255,255,255,.9)" />
        </svg>
      );
  }
}

/** Foto als die er is, anders de SVG. Laadt de foto niet, dan valt het terug op de SVG. */
export function ItemPic({ item, className = "" }: { item: Pick<MenuItemView, "image" | "art" | "color">; className?: string }) {
  const [broken, setBroken] = useState(false);
  if (item.image && !broken) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={item.image} alt="" loading="lazy" onError={() => setBroken(true)} className={`h-full w-full object-contain ${className}`} />;
  }
  return <ArtSvg art={item.art} color={item.color} />;
}

/**
 * Kaartframe met collector-nummer. Eten met foto: vierkant, zonder witte
 * rand (foto vult het frame). Dranken en illustraties: 63:72 met witte rand.
 */
export function ItemArt({ item, size = "md" }: { item: Pick<MenuItemView, "image" | "art" | "color" | "no" | "category">; size?: "sm" | "md" }) {
  const photoFood = !!item.image && item.category !== "drank";
  const dims = size === "sm" ? "w-14" : "w-full";
  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-xl bg-white ${dims} ${photoFood ? "aspect-square" : "aspect-[63/72] border border-[var(--line)] p-1.5"}`}
    >
      <ItemPic item={item} />
      {item.no && (
        <span className="absolute bottom-1 right-1.5 rounded bg-black/55 px-1 py-px font-mono text-[9px] font-semibold tracking-wide text-white">{item.no}</span>
      )}
    </div>
  );
}
