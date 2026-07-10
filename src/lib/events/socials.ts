export const MAX_SOCIAL_LINKS = 4;

export type SocialPlatform = "instagram" | "facebook" | "youtube" | "x" | "tiktok" | "discord" | "other";

/** JSON-string → gevalideerde lijst social-URL's (max 4, alleen http(s)). */
export function parseSocialLinks(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((u): u is string => typeof u === "string")
      .map((u) => u.trim())
      .filter((u) => /^https?:\/\//i.test(u))
      .slice(0, MAX_SOCIAL_LINKS);
  } catch {
    return [];
  }
}

/** Platform-detectie uit de URL — label + platform-key voor <SocialIcon>. */
export function detectSocialPlatform(url: string): { label: string; platform: SocialPlatform } {
  let host = "";
  try {
    host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return { label: "Link", platform: "other" };
  }
  if (host.includes("instagram.com")) return { label: "Instagram", platform: "instagram" };
  if (host.includes("facebook.com") || host.includes("fb.com")) return { label: "Facebook", platform: "facebook" };
  if (host.includes("youtube.com") || host.includes("youtu.be")) return { label: "YouTube", platform: "youtube" };
  if (host.includes("x.com") || host.includes("twitter.com")) return { label: "X", platform: "x" };
  if (host.includes("tiktok.com")) return { label: "TikTok", platform: "tiktok" };
  if (host.includes("discord.gg") || host.includes("discord.com")) return { label: "Discord", platform: "discord" };
  return { label: "Link", platform: "other" };
}
