import { Link2 } from "lucide-react";
import type { SocialPlatform } from "@/lib/events/socials";

/** Brand-iconen zijn uit lucide-react verwijderd — dit zijn de oude
 *  MIT-gelicenseerde lucide-paths als inline SVG, zelfde stroke-stijl.
 *  TikTok/Discord/onbekend vallen terug op het generieke Link2-icoon. */
function BrandSvg({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {children}
    </svg>
  );
}

export function SocialIcon({ platform, className }: { platform: SocialPlatform; className?: string }) {
  switch (platform) {
    case "instagram":
      return (
        <BrandSvg className={className}>
          <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
          <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
        </BrandSvg>
      );
    case "facebook":
      return (
        <BrandSvg className={className}>
          <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
        </BrandSvg>
      );
    case "youtube":
      return (
        <BrandSvg className={className}>
          <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
          <path d="m10 15 5-3-5-3z" />
        </BrandSvg>
      );
    case "x":
      return (
        <BrandSvg className={className}>
          <path d="M4 4l16 16" />
          <path d="M20 4L4 20" />
        </BrandSvg>
      );
    default:
      return <Link2 className={className} />;
  }
}
