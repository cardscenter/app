// PLACEHOLDER content. Vervang met echte reviews vóór productie-launch.
// Fase 36.10: sectie wordt verborgen tot er ≥3 5-sterren-reviews zijn (via `fiveStarCount` prop).
import { useTranslations } from "next-intl";
import { Star, Quote } from "lucide-react";
import { StaggerContainer, StaggerItem } from "@/components/home/animated-section";

const TESTIMONIALS = [
  {
    quoteKey: "testimonial1Quote",
    initialsKey: "testimonial1Initials",
    roleKey: "testimonial1Role",
    rating: 5,
  },
  {
    quoteKey: "testimonial2Quote",
    initialsKey: "testimonial2Initials",
    roleKey: "testimonial2Role",
    rating: 5,
  },
  {
    quoteKey: "testimonial3Quote",
    initialsKey: "testimonial3Initials",
    roleKey: "testimonial3Role",
    rating: 5,
  },
] as const;

function FiveStars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`size-4 ${
            star <= rating
              ? "fill-amber-400 text-amber-400"
              : "fill-none text-muted-foreground/30"
          }`}
        />
      ))}
    </div>
  );
}

interface TestimonialsSectionProps {
  fiveStarCount?: number;
}

const MIN_FIVE_STAR_FOR_DISPLAY = 3;

export function TestimonialsSection({ fiveStarCount = 0 }: TestimonialsSectionProps) {
  const t = useTranslations("home");

  // Fase 36.10: verbergen tot er ≥3 echte 5-sterren-reviews zijn — placeholder-content
  // blijft in code voor de toekomstige echte-reviews-fase.
  if (fiveStarCount < MIN_FIVE_STAR_FOR_DISPLAY) return null;

  return (
    <section className="bg-background py-16 lg:py-24">
      <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-8 xl:px-10">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            {t("testimonialsTitle")}
          </h2>
          <p className="mt-4 text-base text-muted-foreground">
            {t("testimonialsSubtitle")}
          </p>
        </div>

        <StaggerContainer
          className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-3"
          staggerDelay={0.12}
        >
          {TESTIMONIALS.map((tm) => (
            <StaggerItem key={tm.quoteKey}>
              <figure className="glass-soft-card flex h-full flex-col p-7">
                <Quote className="size-6 text-muted-foreground/40" aria-hidden />
                <FiveStars rating={tm.rating} />
                <blockquote className="mt-4 flex-1 text-base leading-relaxed text-foreground">
                  &ldquo;{t(tm.quoteKey)}&rdquo;
                </blockquote>
                <figcaption className="mt-6 flex items-center gap-3 border-t border-border/60 pt-4">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {t(tm.initialsKey)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {t(tm.roleKey)}
                  </div>
                </figcaption>
              </figure>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </div>
    </section>
  );
}
