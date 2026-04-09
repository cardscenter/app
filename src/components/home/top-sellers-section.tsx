import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Users, Star, ShieldCheck } from "lucide-react";
import { AnimatedSection, StaggerContainer, StaggerItem } from "@/components/home/animated-section";
import type { TopSeller } from "@/lib/homepage-data";

interface TopSellersSectionProps {
  sellers: TopSeller[];
}

export function TopSellersSection({ sellers }: TopSellersSectionProps) {
  const t = useTranslations("home");

  if (sellers.length === 0) return null;

  return (
    <section className="py-8 sm:py-14 border-t border-border section-gradient">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <AnimatedSection>
          <div className="flex items-center gap-3 mb-8">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
              <Users className="size-4" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">{t("topSellers")}</h2>
              <p className="text-sm text-muted-foreground">{t("topSellersDesc")}</p>
            </div>
          </div>
        </AnimatedSection>

        <StaggerContainer
          className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6"
          staggerDelay={0.08}
        >
          {sellers.map((seller) => (
            <StaggerItem key={seller.id}>
              <Link
                href={`/verkoper/${seller.id}`}
                className="glass rounded-2xl p-4 flex flex-col items-center text-center transition-all hover:shadow-lg hover:scale-[1.03] group"
              >
                {/* Avatar */}
                <div className="relative">
                  <div className="h-16 w-16 rounded-full overflow-hidden bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border-2 border-border group-hover:border-primary transition-colors">
                    {seller.avatarUrl ? (
                      <img
                        src={seller.avatarUrl}
                        alt={seller.displayName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-xl font-bold text-primary">
                        {seller.displayName.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  {seller.isVerified && (
                    <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white">
                      <ShieldCheck className="size-3" />
                    </div>
                  )}
                </div>

                {/* Name */}
                <h3 className="mt-3 text-sm font-semibold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                  {seller.displayName}
                </h3>

                {/* Level badge */}
                <span className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${seller.levelBgColor} ${seller.levelColor}`}>
                  <span>{seller.levelIcon}</span>
                  <span>{seller.levelName}</span>
                </span>

                {/* Rating */}
                {seller.totalReviews > 0 && (
                  <div className="mt-2 flex items-center gap-1">
                    <Star className="size-3 fill-yellow-400 text-yellow-400" />
                    <span className="text-xs font-medium text-foreground">
                      {seller.avgRating.toFixed(1)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      ({seller.totalReviews})
                    </span>
                  </div>
                )}

                {/* Sales count */}
                <p className="mt-1 text-xs text-muted-foreground">
                  {seller.totalSales} {t("salesCount")}
                </p>
              </Link>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </div>
    </section>
  );
}
