import Image from "next/image";
import { useTranslations } from "next-intl";
import { BadgeCheck, User as UserIcon } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { CountryFlag } from "@/components/ui/country-flag";
import type { UserHit } from "@/lib/global-search";

/** Gebruikers-kaart voor de Gebruikers-tab op /zoeken: avatar, naam,
 *  verified-vinkje, particulier/zakelijk, plaats + vlag, lid-sinds-jaar. */
export function UserResultCard({ user }: { user: UserHit }) {
  const t = useTranslations("search");
  const memberYear = new Date(user.createdAt).getFullYear();

  return (
    <Link
      href={user.href}
      className="group flex flex-col overflow-hidden rounded-[12px] bg-white shadow-[0_2px_8px_0_var(--cc-border-subtle)] transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-24px_rgba(32,32,32,0.35)] flex-row items-center gap-3 p-4"
    >
      <div className="relative size-12 shrink-0 overflow-hidden rounded-[22%] bg-muted">
        {user.avatarUrl ? (
          <Image
            src={user.avatarUrl}
            alt={user.displayName}
            fill
            className="object-cover"
            sizes="48px"
            unoptimized
          />
        ) : (
          <div className="flex size-full items-center justify-center">
            <UserIcon className="size-6 text-muted-foreground/50" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate font-semibold text-foreground group-hover:text-primary transition-colors">
            {user.displayName}
          </p>
          {user.isVerified && (
            <BadgeCheck
              className="size-4 shrink-0 text-sky-500"
              aria-label={t("verified")}
            />
          )}
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {user.accountKind === "BUSINESS" ? t("accountBusiness") : t("accountPrivate")}
          {" · "}
          {t("memberSince", { year: memberYear })}
        </p>
        {(user.city || user.country) && (
          <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
            <CountryFlag code={user.country} size="xs" />
            {user.city}
          </p>
        )}
      </div>
    </Link>
  );
}
