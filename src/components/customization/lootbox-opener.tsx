"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { EmberIcon } from "@/components/customization/ember-icon";
import { openLootbox, recycleDuplicate } from "@/actions/customization";
import { getRarity } from "@/lib/cosmetic-config";
import { getArtist, countryFlag } from "@/lib/fan-artists";
import { cn } from "@/lib/utils";
import { Sparkles, RotateCcw, Backpack } from "lucide-react";

type CarouselItem = {
  id: string;
  key: string;
  name: string;
  rarity: string;
  type: string;
  assetPath: string | null;
  artistKey: string | null;
};

type ResultItem = CarouselItem & {
  type: string;
  rewardValue: number | null;
};

type Phase = "IDLE" | "SPINNING" | "REVEALING";

interface LootboxOpenerProps {
  lootboxId: string;
  lootboxName: string;
  emberCost: number;
  lootboxImage: string | null;
  previewItems: Array<{
    id: string;
    key: string;
    name: string;
    rarity: string;
    type: string;
    assetPath: string | null;
    artistKey: string | null;
  }>;
  currentBalance: number;
  isLoggedIn: boolean;
}

const ITEM_WIDTH = 200;
const ITEM_GAP = 12;
const SLOT_WIDTH = ITEM_WIDTH + ITEM_GAP;

const TYPE_LABELS: Record<string, string> = {
  BANNER: "Banner",
  EMBLEM: "Emblem",
  BACKGROUND: "Background",
  XP_REWARD: "XP",
  EMBER_REWARD: "Ember",
};

function TypeBadge({ type }: { type: string }) {
  const label = TYPE_LABELS[type];
  if (!label) return null;
  return (
    <span className="absolute bottom-1.5 left-1.5 z-10 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white/90 backdrop-blur-sm">
      {label}
    </span>
  );
}

function ItemPlaceholder({ type, rarity }: { type: string; rarity: string }) {
  const r = getRarity(rarity);
  if (type === "EMBER_REWARD") {
    return (
      <div className={cn("flex h-36 w-full flex-col items-center justify-center gap-1 rounded-lg", r.bgColor)}>
        <EmberIcon className="size-10" />
      </div>
    );
  }
  if (type === "XP_REWARD") {
    return (
      <div className={cn("flex h-36 w-full items-center justify-center rounded-lg text-4xl", r.bgColor)}>
        ⭐
      </div>
    );
  }
  return (
    <div className={cn("flex h-36 w-full items-center justify-center rounded-lg text-3xl", r.bgColor)}>
      {type === "BANNER" ? "🖼️" : type === "EMBLEM" ? "🛡️" : "✨"}
    </div>
  );
}

export function LootboxOpener({
  lootboxId,
  lootboxName,
  emberCost,
  lootboxImage,
  previewItems,
  currentBalance,
  isLoggedIn,
}: LootboxOpenerProps) {
  const t = useTranslations("customization");
  const router = useRouter();
  const stripRef = useRef<HTMLDivElement>(null);

  const [phase, setPhase] = useState<Phase>("IDLE");
  const [carousel, setCarousel] = useState<CarouselItem[]>([]);
  const [resultItem, setResultItem] = useState<ResultItem | null>(null);
  const [wasDuplicate, setWasDuplicate] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [balance, setBalance] = useState(currentBalance);
  const [lootboxCost, setLootboxCost] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [recycleResult, setRecycleResult] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);

  const canAfford = balance >= emberCost;
  const idleStripRef = useRef<HTMLDivElement>(null);
  const idleAnimRef = useRef<number | null>(null);

  // Idle drift animation
  useEffect(() => {
    if (phase !== "IDLE" || carousel.length > 0) {
      if (idleAnimRef.current) cancelAnimationFrame(idleAnimRef.current);
      return;
    }
    const strip = idleStripRef.current;
    if (!strip) return;

    let offset = 0;
    const speed = 0.4;

    function animate() {
      offset += speed;
      const totalWidth = strip!.scrollWidth / 2;
      if (offset >= totalWidth) offset = 0;
      strip!.style.transform = `translateX(-${offset}px)`;
      idleAnimRef.current = requestAnimationFrame(animate);
    }
    idleAnimRef.current = requestAnimationFrame(animate);

    return () => {
      if (idleAnimRef.current) cancelAnimationFrame(idleAnimRef.current);
    };
  }, [phase, carousel.length, previewItems]);

  const handleOpen = useCallback(async () => {
    if (!isLoggedIn || !canAfford || phase !== "IDLE") return;
    setError(null);
    setRecycleResult(null);
    setShowConfetti(false);

    const result = await openLootbox(lootboxId);
    if ("error" in result && result.error) {
      setError(result.error);
      return;
    }

    if (!("success" in result) || !result.success) return;

    setCarousel(result.carouselItems);
    setResultItem(result.resultItem as ResultItem);
    setWasDuplicate(result.wasDuplicate);
    setOpeningId(result.openingId);
    setBalance(result.newEmberBalance);
    setLootboxCost(result.lootboxCost);
    setPhase("SPINNING");

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (stripRef.current) {
          const resultIdx = result.resultIndex;
          const containerWidth = stripRef.current.parentElement?.clientWidth ?? 600;
          const targetOffset = resultIdx * SLOT_WIDTH - containerWidth / 2 + ITEM_WIDTH / 2;

          stripRef.current.style.transition = "transform 8s cubic-bezier(0.12, 0.8, 0.3, 1)";
          stripRef.current.style.transform = `translateX(-${targetOffset}px)`;
        }
      });
    });

    setTimeout(() => {
      setPhase("REVEALING");
      if (!result.wasDuplicate) {
        setShowConfetti(true);
      }
    }, 8400);
  }, [lootboxId, isLoggedIn, canAfford, phase]);

  const handleRecycle = async (choice: "XP" | "EMBER") => {
    if (!openingId) return;
    const result = await recycleDuplicate(openingId, choice);
    if ("error" in result && result.error) {
      setError(result.error);
      return;
    }
    if ("xpAwarded" in result) {
      setRecycleResult(`+${result.xpAwarded} XP`);
    } else if ("emberRefund" in result) {
      setBalance((b) => b + (result.emberRefund ?? 0));
      setRecycleResult(`+${result.emberRefund} Ember`);
    }
  };

  const handleReset = () => {
    setPhase("IDLE");
    setCarousel([]);
    setResultItem(null);
    setWasDuplicate(false);
    setOpeningId(null);
    setRecycleResult(null);
    setShowConfetti(false);
    if (stripRef.current) {
      stripRef.current.style.transition = "none";
      stripRef.current.style.transform = "translateX(0)";
    }
    router.refresh();
  };

  return (
    <div className="space-y-6">
      {/* Spinner Container — dark immersive box */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 shadow-2xl ring-1 ring-white/10">
        {/* Subtle ambient gradient */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-orange-500/5 via-transparent to-purple-500/5" />

        {/* Center pointer — glowing line */}
        <div className="pointer-events-none absolute inset-y-0 left-1/2 z-20 w-[2px] -translate-x-1/2 bg-gradient-to-b from-orange-400/0 via-orange-400 to-orange-400/0" />
        <div className="pointer-events-none absolute left-1/2 top-0 z-20 -translate-x-1/2">
          <div className="size-0 border-l-[10px] border-r-[10px] border-t-[14px] border-l-transparent border-r-transparent border-t-orange-400 drop-shadow-[0_0_8px_rgba(251,146,60,0.6)]" />
        </div>
        <div className="pointer-events-none absolute bottom-0 left-1/2 z-20 -translate-x-1/2 rotate-180">
          <div className="size-0 border-l-[10px] border-r-[10px] border-t-[14px] border-l-transparent border-r-transparent border-t-orange-400 drop-shadow-[0_0_8px_rgba(251,146,60,0.6)]" />
        </div>

        {/* Edge fade overlays */}
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-slate-950 to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-slate-950 to-transparent" />

        {/* Carousel strip */}
        <div className="relative h-72 overflow-hidden py-4">
          {phase === "IDLE" && carousel.length === 0 ? (
            <div className="flex h-full items-center overflow-hidden">
              <div
                ref={idleStripRef}
                className="flex items-center gap-3"
                style={{ willChange: "transform" }}
              >
                {[...previewItems, ...previewItems].map((item, i) => {
                  const rarity = getRarity(item.rarity);
                  const isShiny = item.rarity === "SHINY";
                  return (
                    <div
                      key={`${item.id}-idle-${i}`}
                      className={cn(
                        "flex shrink-0 flex-col items-center rounded-xl border bg-slate-800/80 p-2.5 transition-all",
                        rarity.borderColor,
                        isShiny && "glow-shiny"
                      )}
                      style={{ width: ITEM_WIDTH }}
                    >
                      {isShiny ? (
                        <div className="relative h-36 w-full overflow-hidden rounded-lg">
                          {item.assetPath ? (
                            <img src={item.assetPath} alt="" className="size-full object-cover blur-xl brightness-50" />
                          ) : (
                            <div className="size-full bg-gradient-to-br from-purple-900/40 via-blue-900/40 to-pink-900/40" />
                          )}
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="rounded-full bg-black/40 p-2 backdrop-blur-sm">
                              <svg className="size-5 shiny-text" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                              </svg>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="relative h-36 w-full overflow-hidden rounded-lg">
                          {item.assetPath ? (
                            <img src={item.assetPath} alt={item.name} className="size-full object-cover" />
                          ) : (
                            <ItemPlaceholder type={item.type} rarity={item.rarity} />
                          )}
                          <TypeBadge type={item.type} />
                        </div>
                      )}
                      <p className={cn("mt-2 w-full text-center text-sm font-medium", isShiny ? "shiny-text font-bold" : "text-white")}>{isShiny ? "???" : item.name}</p>
                      <span className={cn("text-xs font-semibold", rarity.textColor)}>{rarity.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div
              ref={stripRef}
              className="absolute left-0 top-1/2 flex -translate-y-1/2 gap-3"
              style={{ willChange: "transform" }}
            >
              {carousel.map((item, i) => {
                const rarity = getRarity(item.rarity);
                const isShiny = item.rarity === "SHINY";
                const isResult = phase === "REVEALING" && resultItem && item.id === resultItem.id && i === Math.floor(carousel.length * 0.8);
                return (
                  <div
                    key={`${item.id}-${i}`}
                    className={cn(
                      "flex shrink-0 flex-col items-center rounded-xl border bg-slate-800/80 p-2.5 transition-all duration-500",
                      rarity.borderColor,
                      isShiny && "glow-shiny",
                      isResult && cn("ring-2 ring-orange-400", rarity.glowClass),
                    )}
                    style={{ width: ITEM_WIDTH }}
                  >
                    {isShiny && !isResult ? (
                      <div className="relative h-36 w-full overflow-hidden rounded-lg">
                        {item.assetPath ? (
                          <img src={item.assetPath} alt="" className="size-full object-cover blur-xl brightness-50" />
                        ) : (
                          <div className="size-full bg-gradient-to-br from-purple-900/40 via-blue-900/40 to-pink-900/40" />
                        )}
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="rounded-full bg-black/40 p-2 backdrop-blur-sm">
                            <svg className="size-5 shiny-text" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="relative h-36 w-full overflow-hidden rounded-lg">
                        {item.assetPath ? (
                          <img src={item.assetPath} alt={item.name} className="size-full object-cover" />
                        ) : (
                          <div className={cn("flex size-full items-center justify-center text-3xl", rarity.bgColor)}>
                            ?
                          </div>
                        )}
                        <TypeBadge type={item.type} />
                      </div>
                    )}
                    <p className={cn("mt-2 w-full text-center text-sm font-medium", isShiny && !isResult ? "shiny-text font-bold" : "text-white")}>{isShiny && !isResult ? "???" : item.name}</p>
                    <span className={cn("text-xs font-semibold", rarity.textColor)}>{rarity.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Result Area — animated reveal */}
      {phase === "REVEALING" && resultItem && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 p-8 text-center shadow-2xl ring-1 ring-white/10">
          {/* Confetti for Epic+ */}
          {showConfetti && <ConfettiParticles rarity={resultItem.rarity} />}

          {/* Ambient glow behind result */}
          <div
            className="pointer-events-none absolute inset-0 opacity-30"
            style={{
              background: `radial-gradient(ellipse at center, ${getRarity(resultItem.rarity).color}40 0%, transparent 70%)`,
            }}
          />

          <div className="relative z-10" style={{ animation: "reveal-scale 0.5s ease-out" }}>
            {wasDuplicate ? (
              <>
                <p className="mb-1 text-sm font-medium uppercase tracking-wider text-yellow-400/80">{t("duplicate")}</p>
                <p className="mb-4 text-sm text-slate-400">{t("duplicateDesc")}</p>
              </>
            ) : (
              <p className="mb-4 text-sm font-medium uppercase tracking-wider text-emerald-400/80">{t("newItem")}</p>
            )}

            {/* Large result card */}
            <div className={cn(
              "mx-auto mb-6 max-w-[calc(100vw-4rem)] inline-block overflow-hidden rounded-2xl border-2",
              getRarity(resultItem.rarity).borderColor,
              getRarity(resultItem.rarity).glowClass
            )}>
              {resultItem.assetPath ? (
                <img
                  src={resultItem.assetPath}
                  alt={resultItem.name}
                  className={cn(
                    "w-full object-cover",
                    resultItem.type === "BANNER" ? "h-48 max-w-[32rem]" : "h-48 max-w-80"
                  )}
                />
              ) : resultItem.type === "EMBER_REWARD" ? (
                <div className={cn("flex h-48 w-80 flex-col items-center justify-center gap-2", getRarity(resultItem.rarity).bgColor)}>
                  <EmberIcon className="size-16" />
                  <span className="text-2xl font-bold text-orange-400">{resultItem.name}</span>
                </div>
              ) : resultItem.type === "XP_REWARD" ? (
                <div className={cn("flex h-48 w-80 flex-col items-center justify-center gap-2", getRarity(resultItem.rarity).bgColor)}>
                  <span className="text-6xl">⭐</span>
                  <span className="text-2xl font-bold text-yellow-400">{resultItem.name}</span>
                </div>
              ) : (
                <div className={cn("flex h-48 w-80 items-center justify-center text-5xl", getRarity(resultItem.rarity).bgColor)}>
                  {resultItem.type === "BANNER" ? "🖼️" : resultItem.type === "EMBLEM" ? "🛡️" : "✨"}
                </div>
              )}
            </div>

            <h3 className="text-xl font-bold text-white">{resultItem.name}</h3>
            <div className="flex items-center justify-center gap-2">
              <span className={cn("text-sm font-bold", getRarity(resultItem.rarity).textColor)}>
                {getRarity(resultItem.rarity).label}
              </span>
              <span className="text-sm text-slate-500">·</span>
              <span className="text-sm text-slate-400">{TYPE_LABELS[resultItem.type] ?? resultItem.type}</span>
            </div>
            {resultItem.artistKey && (() => {
              const artist = getArtist(resultItem.artistKey);
              return artist ? (
                <p className="mt-1 text-sm text-slate-400">
                  {countryFlag(artist.country)} {artist.name}
                </p>
              ) : null;
            })()}

            {wasDuplicate && (
              <div className="mt-6">
                {recycleResult ? (
                  <p className="text-lg font-bold text-emerald-400">{recycleResult}</p>
                ) : (
                  <div className="flex justify-center gap-3">
                    <button
                      onClick={() => handleRecycle("XP")}
                      className="rounded-xl bg-blue-500/20 px-5 py-2.5 text-sm font-semibold text-blue-300 ring-1 ring-blue-500/30 transition-all hover:bg-blue-500/30 hover:ring-blue-400/50"
                    >
                      {t("recycleForXP", { amount: 5 })}
                    </button>
                    <button
                      onClick={() => handleRecycle("EMBER")}
                      className="rounded-xl bg-orange-500/20 px-5 py-2.5 text-sm font-semibold text-orange-300 ring-1 ring-orange-500/30 transition-all hover:bg-orange-500/30 hover:ring-orange-400/50"
                    >
                      {t("recycleForEmber", { amount: Math.floor(lootboxCost * getRarity(resultItem.rarity).recycleRate) })}
                    </button>
                  </div>
                )}
              </div>
            )}

            {!wasDuplicate && (
              <p className="mt-2 text-sm text-slate-400">
                {resultItem.type === "XP_REWARD"
                  ? t("xpAddedToAccount")
                  : resultItem.type === "EMBER_REWARD"
                    ? t("emberAddedToBalance")
                    : t("addedToInventory")}
              </p>
            )}

            <div className="mt-8 flex justify-center gap-3">
              <button
                onClick={handleReset}
                className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-orange-500/25 transition-all hover:bg-orange-400 hover:shadow-orange-500/40"
              >
                <RotateCcw className="size-4" />
                {t("openAnother")}
              </button>
              <Link
                href="/customization/inventory"
                className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-slate-300 ring-1 ring-white/10 transition-all hover:bg-white/5 hover:text-white"
              >
                <Backpack className="size-4" />
                {t("viewInventory")}
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Open Button */}
      {phase === "IDLE" && (
        <div className="text-center">
          {!isLoggedIn ? (
            <p className="text-muted-foreground">{t("loginToOpen")}</p>
          ) : (
            <>
              <button
                onClick={handleOpen}
                disabled={!canAfford}
                className="group relative inline-flex items-center gap-2.5 overflow-hidden rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 px-10 py-4 text-lg font-bold text-white shadow-xl shadow-orange-500/25 transition-all hover:shadow-orange-500/40 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
              >
                <span className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 opacity-0 transition-opacity group-hover:opacity-100" />
                <EmberIcon className="size-6" />
                {t("openPack")} — {emberCost} Ember
              </button>
              {!canAfford && (
                <p className="mt-3 text-sm text-red-400">{t("insufficientBalance")}</p>
              )}
            </>
          )}
          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        </div>
      )}

      {phase === "SPINNING" && (
        <div className="flex items-center justify-center gap-2 text-center">
          <Sparkles className="size-5 animate-pulse text-orange-400" />
          <p className="animate-pulse text-lg font-semibold text-orange-400">{t("spinning")}</p>
          <Sparkles className="size-5 animate-pulse text-orange-400" />
        </div>
      )}
    </div>
  );
}

/** Canvas-based confetti cannon — shoots upward from bottom corners */
function ConfettiParticles({ rarity }: { rarity: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const palettes: Record<string, string[]> = {
      UNCOMMON: ["#22c55e", "#4ade80", "#16a34a", "#86efac"],
      RARE: ["#3b82f6", "#60a5fa", "#2563eb", "#93c5fd"],
      EPIC: ["#a855f7", "#c084fc", "#7c3aed", "#d8b4fe"],
      LEGENDARY: ["#eab308", "#facc15", "#f59e0b", "#fde047"],
      UNIQUE: ["#ef4444", "#f87171", "#eab308", "#a855f7", "#facc15", "#c084fc"],
      SHINY: ["#f0c040", "#fde047", "#fbbf24", "#f59e0b", "#ffffff", "#fef3c7"],
    };
    const colors = palettes[rarity] ?? palettes.UNCOMMON;

    const rect = canvas.parentElement!.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    const W = canvas.width;
    const H = canvas.height;
    const gravity = 0.15;
    const friction = 0.99;

    // More particles for higher rarities
    const baseCount = rarity === "SHINY" ? 150 : rarity === "UNIQUE" ? 120 : rarity === "LEGENDARY" ? 100 : 60;
    // Shiny gets 7 bursts, Unique 5, Legendary 3, Epic 2, rest 1
    const burstCount = rarity === "SHINY" ? 7 : rarity === "UNIQUE" ? 5 : rarity === "LEGENDARY" ? 3 : rarity === "EPIC" ? 2 : 1;

    type Particle = {
      x: number; y: number;
      vx: number; vy: number;
      color: string;
      size: number;
      rotation: number;
      rotationSpeed: number;
      shape: "rect" | "circle";
      life: number;
    };

    const particles: Particle[] = [];
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    function spawnBurst() {
      for (let i = 0; i < baseCount; i++) {
        const fromLeft = i % 2 === 0;
        const originX = fromLeft ? W * 0.15 : W * 0.85;
        const speed = 8 + Math.random() * 12;
        const spread = Math.random() * 0.6;
        const vx = fromLeft
          ? speed * (0.3 + spread)
          : -speed * (0.3 + spread);
        const vy = -(speed * (0.7 + Math.random() * 0.5));

        particles.push({
          x: originX + (Math.random() - 0.5) * 30,
          y: H,
          vx: vx + (Math.random() - 0.5) * 3,
          vy,
          color: colors[Math.floor(Math.random() * colors.length)],
          size: 5 + Math.random() * 8,
          rotation: Math.random() * Math.PI * 2,
          rotationSpeed: (Math.random() - 0.5) * 0.3,
          shape: Math.random() > 0.4 ? "rect" : "circle",
          life: 1,
        });
      }
    }

    // Fire first burst immediately
    spawnBurst();

    // Schedule additional bursts with 500ms intervals
    for (let b = 1; b < burstCount; b++) {
      timeouts.push(setTimeout(spawnBurst, b * 500));
    }

    let animId: number;
    function draw() {
      ctx!.clearRect(0, 0, W, H);
      let alive = 0;

      for (const p of particles) {
        if (p.life <= 0) continue;
        alive++;

        p.vy += gravity;
        p.vx *= friction;
        p.vy *= friction;
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotationSpeed;

        if (p.vy > 0) {
          p.life -= 0.01;
        }

        ctx!.save();
        ctx!.globalAlpha = Math.max(0, p.life);
        ctx!.translate(p.x, p.y);
        ctx!.rotate(p.rotation);
        ctx!.fillStyle = p.color;

        if (p.shape === "rect") {
          ctx!.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        } else {
          ctx!.beginPath();
          ctx!.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx!.fill();
        }
        ctx!.restore();
      }

      // Keep running if there are scheduled bursts or alive particles
      if (alive > 0 || timeouts.some((_, i) => i + 1 < burstCount)) {
        animId = requestAnimationFrame(draw);
      }
    }

    animId = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(animId);
      timeouts.forEach(clearTimeout);
    };
  }, [rarity]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 z-20"
    />
  );
}
