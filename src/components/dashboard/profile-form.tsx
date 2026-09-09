"use client";

import { useRef, useState, useActionState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { Link } from "@/i18n/navigation";
import {
  Camera,
  Check,
  Globe,
  ImageIcon,
  Loader2,
  MapPin,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { updateProfile } from "@/actions/profile";
import { USERNAME_MAX, USERNAME_MIN, validateUsername } from "@/lib/username-policy";
import { MAX_SOCIAL_LINKS, detectSocialPlatform } from "@/lib/events/socials";
import { getCountryName } from "@/lib/shipping/countries";
import { AvatarCropModal } from "@/components/ui/avatar-crop-modal";
import { CountryFlag } from "@/components/ui/country-flag";
import { SocialIcon } from "@/components/events/social-icon";
import { FieldRow } from "@/components/dashboard/ui/field-row";

const BIO_MAX = 500;

export const PROFILE_INPUT_CLASS =
  "block w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/70 transition-colors focus:border-primary focus:outline-none focus:ring-3 focus:ring-primary/15";

const PILL_BUTTON =
  "inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50";

type ProfileFormUser = {
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  coverImageUrl: string | null;
  websiteUrl: string | null;
  city: string | null;
  country: string | null;
};

type Props = {
  user: ProfileFormUser;
  /** Reeds geparste socials (JSON → string[]). */
  socialLinks: string[];
  /** Tailwind `from-… to-…`-klassen voor de omslag-fallback (level-kleur). */
  fallbackGradient: string;
};

/**
 * Profielformulier (redesign sept 2026, naar Connext-referentie): omslagfoto
 * bovenaan, daaronder rijen label-links/veld-rechts. Alles wat hier staat is
 * publiek zichtbaar op /verkoper/[id]. Eén Opslaan-knop onderaan.
 */
export function ProfileForm({ user, socialLinks: initialSocials, fallbackGradient }: Props) {
  const t = useTranslations("profile");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();

  // Avatar
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user.avatarUrl);
  // Kapotte avatar-URL (oude/externe upload) → toon de initiaal i.p.v. een broken image.
  const [avatarBroken, setAvatarBroken] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);

  // Omslagfoto — direct via /api/upload (context "cover", gemodereerd);
  // het formulier stuurt alleen het resulterende pad mee.
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(user.coverImageUrl);
  const [coverUploading, setCoverUploading] = useState(false);

  // Tekstvelden
  const [displayName, setDisplayName] = useState(user.displayName);
  const [bio, setBio] = useState(user.bio ?? "");
  const [website, setWebsite] = useState(user.websiteUrl ?? "");
  const [socials, setSocials] = useState<string[]>(initialSocials);

  const [state, formAction, pending] = useActionState(
    async (_prev: { success?: boolean; error?: string } | null | undefined, formData: FormData) => {
      if (avatarFile) formData.set("avatarFile", avatarFile);
      if (removeAvatar) formData.set("removeAvatar", "true");
      formData.set("coverImageUrl", coverUrl ?? "");
      const result = await updateProfile(formData);
      if (result?.success) {
        setAvatarFile(null);
        setRemoveAvatar(false);
        window.dispatchEvent(
          new CustomEvent("avatar-updated", { detail: { avatarUrl: result.avatarUrl } }),
        );
        toast.success(t("saved"));
        router.refresh();
      }
      return result ?? null;
    },
    null,
  );

  // ---- avatar ----
  function handleAvatarSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCropSrc(URL.createObjectURL(file));
  }
  function handleCropConfirm(blob: Blob) {
    setAvatarFile(new File([blob], "avatar.webp", { type: "image/webp" }));
    setRemoveAvatar(false);
    setAvatarPreview(URL.createObjectURL(blob));
    setAvatarBroken(false);
    setCropSrc(null);
    if (avatarInputRef.current) avatarInputRef.current.value = "";
  }
  function handleCropCancel() {
    setCropSrc(null);
    if (avatarInputRef.current) avatarInputRef.current.value = "";
  }
  function handleRemoveAvatar() {
    setAvatarFile(null);
    setRemoveAvatar(true);
    setAvatarPreview(null);
    if (avatarInputRef.current) avatarInputRef.current.value = "";
  }

  // ---- omslag ----
  async function handleCoverSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setCoverUploading(true);
    try {
      const fd = new FormData();
      fd.append("files", file);
      fd.append("context", "cover");
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = (await res.json()) as { urls?: string[]; errors?: string[] };
      if (data.urls?.[0]) {
        setCoverUrl(data.urls[0]);
      } else {
        toast.error(data.errors?.[0] ?? t("coverUploadFailed"));
      }
    } catch {
      toast.error(t("coverUploadFailed"));
    } finally {
      setCoverUploading(false);
    }
  }

  // ---- gebruikersnaam-check (client-side spiegel van de server-policy) ----
  const nameTrimmed = displayName.trim();
  const isRename = nameTrimmed.toLowerCase() !== user.displayName.toLowerCase();
  const nameCheck = isRename ? validateUsername(nameTrimmed) : { ok: true as const };
  const nameValid = nameTrimmed.length > 0 && nameCheck.ok;

  const initial = (displayName || user.displayName).charAt(0).toUpperCase();
  const hasLocation = !!(user.city || user.country);

  return (
    <>
      {cropSrc && (
        <AvatarCropModal imageSrc={cropSrc} onConfirm={handleCropConfirm} onCancel={handleCropCancel} />
      )}

      <form action={formAction}>
        {/* Omslagfoto — full-bleed bovenin de kaart */}
        <div className="relative aspect-[5/1] min-h-32 w-full overflow-hidden">
          {coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverUrl} alt="" className="size-full object-cover" />
          ) : (
            <div className={`size-full bg-gradient-to-r ${fallbackGradient} opacity-60 dark:opacity-50`} />
          )}
          <div className="absolute right-3 top-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => coverInputRef.current?.click()}
              disabled={coverUploading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/95 px-3 py-1.5 text-xs font-medium text-slate-900 shadow-sm ring-1 ring-black/5 transition-colors hover:bg-white disabled:opacity-60"
            >
              {coverUploading ? <Loader2 className="size-3.5 animate-spin" /> : <ImageIcon className="size-3.5" />}
              {t("coverEdit")}
            </button>
            {coverUrl && (
              <button
                type="button"
                onClick={() => setCoverUrl(null)}
                title={t("coverRemove")}
                aria-label={t("coverRemove")}
                className="inline-flex size-8 items-center justify-center rounded-lg bg-white/95 text-slate-700 shadow-sm ring-1 ring-black/5 transition-colors hover:bg-white hover:text-red-600"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
          <input
            ref={coverInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleCoverSelect}
            className="hidden"
          />
        </div>

        <div className="px-5 py-6 sm:px-6">
          {/* Gebruikersnaam */}
          <FieldRow
            label={t("displayName")}
            hint={t("displayNameHint", { min: USERNAME_MIN, max: USERNAME_MAX })}
            htmlFor="displayName"
          >
            <div className="relative flex rounded-lg border border-border bg-card transition-colors focus-within:border-primary focus-within:ring-3 focus-within:ring-primary/15">
              <span className="flex select-none items-center border-r border-border bg-muted/60 px-3 text-sm text-muted-foreground">
                @
              </span>
              <input
                id="displayName"
                name="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                maxLength={Math.max(USERNAME_MAX, user.displayName.length)}
                className="block w-full bg-transparent px-3 py-2.5 pr-10 text-sm text-foreground outline-none"
                autoComplete="username"
                spellCheck={false}
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                {nameValid ? (
                  <span className="flex size-4 items-center justify-center rounded-full bg-emerald-500 text-white">
                    <Check className="size-3" strokeWidth={3} />
                  </span>
                ) : null}
              </span>
            </div>
            {!nameCheck.ok && nameTrimmed.length > 0 && (
              <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{nameCheck.error}</p>
            )}
          </FieldRow>

          {/* Profielfoto */}
          <FieldRow label={t("profilePhoto")} hint={t("photoVisibleHint")}>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                className="group relative size-20 shrink-0 overflow-hidden rounded-xl border border-border bg-muted"
                aria-label={t("changePhoto")}
              >
                {avatarPreview && !avatarBroken ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarPreview}
                    alt=""
                    className="size-full object-cover"
                    onError={() => setAvatarBroken(true)}
                  />
                ) : (
                  <div className="flex size-full items-center justify-center text-2xl font-bold text-muted-foreground">
                    {initial}
                  </div>
                )}
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                  <Camera className="size-5 text-white" />
                </div>
              </button>
              <div className="flex flex-col items-start gap-2">
                <button type="button" onClick={() => avatarInputRef.current?.click()} className={PILL_BUTTON}>
                  <Upload className="size-3.5" />
                  {t("uploadNewPhoto")}
                </button>
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  disabled={!avatarPreview}
                  className={PILL_BUTTON}
                >
                  <Trash2 className="size-3.5" />
                  {t("removePhoto")}
                </button>
              </div>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleAvatarSelect}
                className="hidden"
              />
            </div>
          </FieldRow>

          {/* Over jou */}
          <FieldRow label={t("aboutYou")} hint={t("aboutYouHint")} htmlFor="bio">
            <textarea
              id="bio"
              name="bio"
              rows={4}
              maxLength={BIO_MAX}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder={t("aboutYouPlaceholder")}
              className={`${PROFILE_INPUT_CLASS} resize-y leading-relaxed`}
            />
            <p className="mt-1 text-right text-[11px] tabular-nums text-muted-foreground">
              {bio.length}/{BIO_MAX}
            </p>
          </FieldRow>

          {/* Locatie — afgeleid van het adres, alleen plaats + land publiek */}
          <FieldRow label={t("location")} hint={t("locationHint")}>
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2.5">
              <span className="inline-flex min-w-0 items-center gap-2 text-sm text-foreground">
                {hasLocation ? (
                  <>
                    {user.country && <CountryFlag code={user.country} size="sm" />}
                    <span className="truncate">
                      {[user.city, user.country ? getCountryName(user.country, locale) : null]
                        .filter(Boolean)
                        .join(", ")}
                    </span>
                  </>
                ) : (
                  <>
                    <MapPin className="size-4 text-muted-foreground" />
                    <span className="text-muted-foreground">{t("locationEmpty")}</span>
                  </>
                )}
              </span>
              <Link
                href="/dashboard/profiel#adres"
                className="shrink-0 text-xs font-medium text-primary transition-colors hover:text-primary-hover"
              >
                {t("locationEdit")}
              </Link>
            </div>
          </FieldRow>

          {/* Website */}
          <FieldRow label={t("website")} hint={t("websiteHint")} htmlFor="websiteUrl">
            <div className="relative">
              <Globe className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                id="websiteUrl"
                name="websiteUrl"
                type="text"
                inputMode="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="jouwwebsite.nl"
                className={`${PROFILE_INPUT_CLASS} pl-9`}
                autoComplete="url"
                spellCheck={false}
              />
            </div>
          </FieldRow>

          {/* Socials */}
          <FieldRow label={t("socials")} hint={t("socialsHint", { max: MAX_SOCIAL_LINKS })}>
            <div className="space-y-2">
              {socials.map((url, i) => {
                const { platform, label } = detectSocialPlatform(url);
                return (
                  <div
                    key={i}
                    className="flex rounded-lg border border-border bg-card transition-colors focus-within:border-primary focus-within:ring-3 focus-within:ring-primary/15"
                  >
                    <span
                      className="flex w-11 shrink-0 items-center justify-center border-r border-border bg-muted/60 text-muted-foreground"
                      title={label}
                    >
                      <SocialIcon platform={platform} className="size-4" />
                    </span>
                    <input
                      name="socialLinks"
                      type="text"
                      inputMode="url"
                      value={url}
                      onChange={(e) =>
                        setSocials((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))
                      }
                      placeholder="instagram.com/jouwnaam"
                      className="block w-full bg-transparent px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground/70"
                      spellCheck={false}
                    />
                    <button
                      type="button"
                      onClick={() => setSocials((prev) => prev.filter((_, j) => j !== i))}
                      aria-label={tc("delete")}
                      className="flex w-10 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-red-600"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                );
              })}
              {socials.length < MAX_SOCIAL_LINKS && (
                <button
                  type="button"
                  onClick={() => setSocials((prev) => [...prev, ""])}
                  className={PILL_BUTTON}
                >
                  <Plus className="size-3.5" />
                  {t("addSocial")}
                </button>
              )}
            </div>
          </FieldRow>

          {/* Opslaan */}
          <div className="mt-2 flex flex-col-reverse items-stretch gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              {state?.error ? (
                <span className="text-red-600 dark:text-red-400">{state.error}</span>
              ) : (
                t("publicNote")
              )}
            </p>
            <button
              type="submit"
              disabled={pending || !nameValid}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-50"
            >
              {pending && <Loader2 className="size-4 animate-spin" />}
              {t("saveProfile")}
            </button>
          </div>
        </div>
      </form>
    </>
  );
}
