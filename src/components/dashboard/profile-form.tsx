"use client";

import { useRef, useState, useActionState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { Link } from "@/i18n/navigation";
import {
  Camera,
  Globe,
  ImageIcon,
  Loader2,
  Lock,
  MapPin,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { updateProfile } from "@/actions/profile";
import { UsernameChangeForm } from "@/components/dashboard/username-change-form";
import { MAX_SOCIAL_LINKS, detectSocialPlatform } from "@/lib/events/socials";
import { getCountryName } from "@/lib/shipping/countries";
import { AvatarCropModal } from "@/components/ui/avatar-crop-modal";
import { CountryFlag } from "@/components/ui/country-flag";
import { SocialIcon } from "@/components/events/social-icon";
import { FieldRow } from "@/components/dashboard/ui/field-row";
import { Callout } from "@/components/dashboard/ui/callout";
import { buttonVariants } from "@/components/ui/button-variants";
import { INPUT, TEXTAREA, PILL_BTN_SM } from "@/components/ploy/tile-styles";

const BIO_MAX = 500;

export const PROFILE_INPUT_CLASS = `block ${INPUT}`;

const PILL_BUTTON = `${PILL_BTN_SM} disabled:opacity-50`;

type ProfileFormUser = {
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  /** Volledige naam is eenmalig invulbaar; daarna alleen via support. */
  fullNameLocked: boolean;
  /** Heeft de gebruiker z'n eenmalige, betaalde naamswijziging nog? */
  canChangeUsername: boolean;
  /** Wanneer die wijziging is verbruikt (null = nog beschikbaar). */
  usernameChangedAt: Date | string | null;
  bio: string | null;
  avatarUrl: string | null;
  coverImageUrl: string | null;
  websiteUrl: string | null;
  city: string | null;
  country: string | null;
};

type Props = {
  user: ProfileFormUser;
  /** Kosten van de eenmalige naamswijziging (uit username-change-config). */
  usernameChangeFee: number;
  /** Reeds geparste socials (JSON → string[]). */
  socialLinks: string[];
  /** Tailwind `from-… to-…`-klassen voor de omslag-fallback (level-kleur). */
  fallbackGradient: string;
};

/**
 * Profielformulier (redesign sept 2026, naar Connext-referentie): omslagfoto
 * bovenaan, daaronder rijen label-links/veld-rechts. Alles wat hier staat is
 * publiek zichtbaar op /spelers/[id]. Eén Opslaan-knop onderaan.
 */
export function ProfileForm({ user, usernameChangeFee, socialLinks: initialSocials, fallbackGradient }: Props) {
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

  const initial = user.displayName.charAt(0).toUpperCase();
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
            <div className={`size-full bg-gradient-to-r ${fallbackGradient} opacity-60`} />
          )}
          <div className="absolute right-3 top-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => coverInputRef.current?.click()}
              disabled={coverUploading}
              className="cc-pill inline-flex items-center gap-1.5 bg-white px-3 py-1.5 text-xs font-semibold text-foreground shadow-card transition-colors hover:bg-[var(--background)] disabled:opacity-60"
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
                className="cc-pill inline-flex size-8 items-center justify-center bg-white text-foreground/70 shadow-card transition-colors hover:text-[var(--destructive)]"
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
          {/* Volledige naam — primair op de site (profiel-redesign sept 2026) */}
          <FieldRow
            label={t("fullName")}
            hint={user.fullNameLocked ? t("fullNameLockedHint") : t("fullNameOnceHint")}
            htmlFor={user.fullNameLocked ? undefined : "firstName"}
          >
            {user.fullNameLocked ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-[10px] border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-foreground">
                  {[user.firstName, user.lastName].filter(Boolean).join(" ") || "—"}
                </span>
                <span className="cc-pill inline-flex items-center gap-1.5 bg-muted px-2.5 py-1.5 text-xs font-semibold text-foreground/70">
                  <Lock className="size-3.5" />
                  {t("usernameLocked")}
                </span>
                <Link href="/support" className="text-xs font-medium text-primary hover:underline">
                  {t("contactSupport")}
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <input
                  id="firstName"
                  name="firstName"
                  type="text"
                  defaultValue={user.firstName ?? ""}
                  maxLength={50}
                  placeholder={t("firstName")}
                  autoComplete="given-name"
                  className={PROFILE_INPUT_CLASS}
                />
                <input
                  id="lastName"
                  name="lastName"
                  type="text"
                  defaultValue={user.lastName ?? ""}
                  maxLength={50}
                  placeholder={t("lastName")}
                  autoComplete="family-name"
                  className={PROFILE_INPUT_CLASS}
                />
              </div>
            )}
          </FieldRow>

          {/* Gebruikersnaam — eenmalig zelf te wijzigen (betaald), daarna
              alleen nog via support. Aparte action, dus niet in dit form. */}
          <FieldRow label={t("displayName")} hint={t("displayNameLockHint")}>
            <UsernameChangeForm
              currentName={user.displayName}
              canChange={user.canChangeUsername}
              usedAt={user.usernameChangedAt}
              fee={usernameChangeFee}
            />
          </FieldRow>

          {/* Profielfoto */}
          <FieldRow label={t("profilePhoto")} hint={t("photoVisibleHint")}>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                className="group relative size-20 shrink-0 overflow-hidden rounded-[22%] border border-border bg-muted"
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
              className={TEXTAREA}
            />
            <p className="mt-1 text-right text-[11px] tabular-nums text-muted-foreground">
              {bio.length}/{BIO_MAX}
            </p>
          </FieldRow>

          {/* Locatie — afgeleid van het adres, alleen plaats + land publiek */}
          <FieldRow label={t("location")} hint={t("locationHint")}>
            <div className="flex items-center justify-between gap-3 rounded-[12px] border border-[var(--border)] bg-white px-3 py-2.5">
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
                    className="flex overflow-hidden rounded-[10px] border border-[var(--border)] bg-white transition-colors focus-within:border-[var(--foreground)]"
                  >
                    <span
                      className="flex w-11 shrink-0 items-center justify-center border-r border-[var(--border)] bg-[var(--background)] text-muted-foreground"
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
                      className="block w-full bg-transparent px-3 py-2 text-sm text-foreground outline-none placeholder:text-[var(--foreground)]/45"
                      spellCheck={false}
                    />
                    <button
                      type="button"
                      onClick={() => setSocials((prev) => prev.filter((_, j) => j !== i))}
                      aria-label={tc("delete")}
                      className="flex w-10 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-[var(--destructive)]"
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
          {state?.error && (
            <Callout tone="pink" className="mt-2">
              {state.error}
            </Callout>
          )}
          <div className="mt-2 flex flex-col-reverse items-stretch gap-3 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">{t("publicNote")}</p>
            <button
              type="submit"
              disabled={pending}
              className={buttonVariants()}
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
