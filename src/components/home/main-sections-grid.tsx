"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { Link } from "@/i18n/navigation";
import { ArrowRight, Gavel, Tag, Store } from "lucide-react";
import { cn } from "@/lib/utils";

// Three big visual entry-points to veilingen / claimsales / marktplaats,
// themed with the Finn & Sage illustrations. Rendered on the logged-in
// homepage below the hero.

interface Section {
  href: string;
  title: string;
  description: string;
  image: string;
  icon: typeof Gavel;
  accent: string;    // accent color classes for the overlay + CTA
  shadow: string;
}

const SECTIONS: Section[] = [
  {
    href: "/veilingen",
    title: "Veilingen",
    description: "Bied mee op kavels en win!",
    image: "/images/finnsage/images/auction.webp",
    icon: Gavel,
    accent: "from-blue-900/70 via-blue-950/50 to-transparent",
    shadow: "shadow-blue-500/20 hover:shadow-blue-500/40",
  },
  {
    href: "/claimsales",
    title: "Claimsales",
    description: "Claim snel kaarten tegen vaste prijzen",
    image: "/images/finnsage/images/claimsale.webp",
    icon: Tag,
    accent: "from-amber-900/70 via-amber-950/50 to-transparent",
    shadow: "shadow-amber-500/20 hover:shadow-amber-500/40",
  },
  {
    href: "/marktplaats",
    title: "Marktplaats",
    description: "Koop en verkoop losse kaarten en collecties",
    image: "/images/finnsage/images/marketplace.webp",
    icon: Store,
    accent: "from-emerald-900/70 via-emerald-950/50 to-transparent",
    shadow: "shadow-emerald-500/20 hover:shadow-emerald-500/40",
  },
];

export function MainSectionsGrid() {
  return (
    <section className="py-10 border-b border-border">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-3">
          {SECTIONS.map((s, i) => (
            <motion.div
              key={s.href}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 + i * 0.1 }}
            >
              <Link
                href={s.href}
                className={cn(
                  "group relative block aspect-[3/2] overflow-hidden rounded-2xl shadow-lg transition-all hover:-translate-y-1",
                  s.shadow
                )}
              >
                <Image
                  src={s.image}
                  alt={s.title}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-110"
                  sizes="(max-width: 768px) 100vw, 33vw"
                />
                <div className={cn("absolute inset-0 bg-gradient-to-t", s.accent)} />
                <div className="absolute inset-0 flex flex-col justify-end p-5 sm:p-6">
                  <div className="mb-2 inline-flex size-9 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm ring-1 ring-white/20">
                    <s.icon className="size-4 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-white drop-shadow-sm">{s.title}</h3>
                  <p className="mt-1 max-w-xs text-sm text-white/80">{s.description}</p>
                  <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-white/90 transition-transform group-hover:translate-x-1">
                    Bekijk alle <ArrowRight className="size-3.5" />
                  </span>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
