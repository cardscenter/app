import { Link } from "@/i18n/navigation";
import { ShieldCheck } from "lucide-react";
import { getLevelByKey } from "@/lib/seller-levels";
import { CosmeticBannerImage } from "@/components/customization/cosmetic-banner-image";

export type VendorCardData = {
  userId: string;
  displayName: string | null;
  companyName: string | null;
  avatarUrl: string | null;
  profileBanner: string | null;
  isVerified: boolean;
};

/** Goedgekeurde standhouders als profiel-kaarten (banner + avatar + naam),
 *  linkend naar het openbare verkoper-profiel. */
export function EventVendorGrid({ vendors }: { vendors: VendorCardData[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {vendors.map((v) => {
        const levelBanner = v.profileBanner ? getLevelByKey(v.profileBanner) : null;
        return (
          <Link
            key={v.userId}
            href={`/verkoper/${v.userId}`}
            className="group overflow-hidden rounded-xl border border-border bg-card shadow-card transition hover:shadow-card-hover"
          >
            {/* Banner-strook */}
            <div className="relative h-14 w-full overflow-hidden bg-muted">
              {levelBanner ? (
                <div className={`size-full bg-gradient-to-br ${levelBanner.gradient}`}>
                  <div className="flex size-full items-center justify-center text-2xl opacity-30 select-none">
                    {levelBanner.icon}
                  </div>
                </div>
              ) : v.profileBanner ? (
                <CosmeticBannerImage bannerKey={v.profileBanner} />
              ) : (
                <div className="size-full bg-gradient-to-r from-indigo-500/20 to-violet-500/20" />
              )}
            </div>

            <div className="px-3 pb-3">
              {/* Avatar met overlap op de banner */}
              {v.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={v.avatarUrl} alt="" className="-mt-5 h-10 w-10 rounded-full object-cover ring-4 ring-card" />
              ) : (
                <span className="-mt-5 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary ring-4 ring-card">
                  {(v.displayName ?? "?").charAt(0).toUpperCase()}
                </span>
              )}
              <p className="mt-1.5 flex items-center gap-1.5 truncate text-sm font-semibold text-foreground group-hover:text-primary">
                {v.displayName ?? "Onbekend"}
                {v.isVerified && <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-sky-500" />}
              </p>
              {v.companyName && <p className="truncate text-xs text-muted-foreground">{v.companyName}</p>}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
