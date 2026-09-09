import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { BadgeCheck, Users } from "lucide-react";
import { getProfileTitle } from "@/lib/user-name";
import { UserAvatar } from "@/components/ui/user-avatar";
import { buttonVariants } from "@/components/ui/button-variants";
import type { SellerProfileData } from "@/lib/seller-profile-data";

/**
 * Team-blok op een bedrijfspagina (profiel-redesign sept 2026): de eigenaar
 * (= het bedrijfsaccount zelf, met voor- en achternaam) plus alle
 * geaccepteerde teamleden. Alleen zichtbaar op BUSINESS-profielen; voor de
 * eigenaar ook als het team nog leeg is, mét link naar het teambeheer.
 */
export async function SellerTeamBlock({ profile, isOwner }: { profile: SellerProfileData; isOwner: boolean }) {
  const t = await getTranslations("sellerProfile");
  const { user, team } = profile;
  if (user.accountKind !== "BUSINESS") return null;
  if (team.length === 0 && !isOwner) return null;

  const ownerName = [user.firstName?.trim(), user.lastName?.trim()].filter(Boolean).join(" ") || user.displayName;
  const companyName = getProfileTitle(user);

  const people: { key: string; href: string; avatarUrl: string | null; name: string; role: string; verified: boolean }[] = [
    {
      key: "owner",
      href: `/verkoper/${user.id}`,
      avatarUrl: user.avatarUrl,
      name: ownerName,
      role: t("owner"),
      verified: user.isVerified,
    },
    ...team.map((m) => ({
      key: m.id,
      href: `/verkoper/${m.userId}`,
      avatarUrl: m.avatarUrl,
      name: m.fullName,
      role: m.title ?? t("teamMember"),
      verified: m.isVerified,
    })),
  ];

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
          <Users className="size-4 text-muted-foreground" />
          {t("team")}
          <span className="text-sm font-normal text-muted-foreground">{t("teamOf", { company: companyName })}</span>
        </h2>
        {isOwner && (
          <Link href="/dashboard/profiel#team" className={buttonVariants({ variant: "outline", size: "sm" })}>
            {t("teamManage")}
          </Link>
        )}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {people.map((p) => (
          <Link
            key={p.key}
            href={p.href}
            className="dash-card flex items-center gap-3 p-3 transition-colors hover:bg-muted/40"
          >
            <UserAvatar src={p.avatarUrl} name={p.name} size="lg" />
            <div className="min-w-0">
              <p className="flex items-center gap-1 truncate text-sm font-semibold text-foreground">
                <span className="truncate">{p.name}</span>
                {p.verified && <BadgeCheck className="size-3.5 shrink-0 text-sky-500" aria-hidden />}
              </p>
              <p className="truncate text-xs text-muted-foreground">{p.role}</p>
            </div>
          </Link>
        ))}
        {isOwner && team.length === 0 && (
          <div className="flex items-center rounded-dash border border-dashed border-border px-4 py-3 text-sm text-muted-foreground sm:col-span-2">
            {t("teamEmptyOwner")}
          </div>
        )}
      </div>
    </section>
  );
}
