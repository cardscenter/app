"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Gavel, Tag, Store } from "lucide-react";
import { SearchBar } from "@/components/search/search-bar";
import type { HomepageStats } from "@/lib/homepage-data";

interface LoggedInHeroProps {
  userName: string;
  stats: HomepageStats;
}

export function LoggedInHero({ userName }: LoggedInHeroProps) {
  const t = useTranslations("home");

  return (
    <section className="section-gradient border-b border-border py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex-1">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
                {t("welcomeBack", { name: userName })}
              </h1>
              <p className="mt-1 text-muted-foreground">{t("quickActions")}</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="mt-4"
            >
              <SearchBar variant="hero" />
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="flex flex-col gap-2 md:min-w-[200px]"
          >
            <Link
              href="/veilingen/nieuw"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-md transition-all hover:bg-primary-hover hover:shadow-lg hover:scale-[1.02]"
            >
              <Gavel className="size-4" />
              {t("createAuction")}
            </Link>
            <Link
              href="/claimsales/nieuw"
              className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-5 py-2.5 text-sm font-medium text-white shadow-md transition-all hover:bg-amber-700 hover:shadow-lg hover:scale-[1.02]"
            >
              <Tag className="size-4" />
              {t("createClaimsale")}
            </Link>
            <Link
              href="/marktplaats/nieuw"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white shadow-md transition-all hover:bg-emerald-700 hover:shadow-lg hover:scale-[1.02]"
            >
              <Store className="size-4" />
              {t("createListing")}
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
