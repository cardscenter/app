"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Cake, Check, Loader2, Mail, ShieldCheck, Send } from "lucide-react";
import { toast } from "sonner";
import { requestGuardianConsent, updatePlayerProfile } from "@/actions/player-profile";
import { ageOn, isMinor, parseDateOfBirth, GUARDIAN_CONSENT_AGE } from "@/lib/age";
import type { GameDefinition } from "@/lib/games";
import { FieldRow } from "@/components/dashboard/ui/field-row";

const INPUT =
  "block w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/70 transition-colors focus:border-primary focus:outline-none focus:ring-3 focus:ring-primary/15";

type Props = {
  games: GameDefinition[];
  initial: {
    dateOfBirth: string;
    favoriteGames: string[];
    playerIds: Record<string, string>;
    guardianName: string;
    guardianEmail: string;
    guardianPhone: string;
    guardianConsentAt: string | null;
  };
};

/**
 * Spelersgegevens op /dashboard/profiel (Community Hub, Fase 2):
 * geboortedatum (nooit publiek), favoriete spellen, spelers-ID's per spel en
 * onder de 16 het ouder-/noodcontact met de toestemmingsstatus.
 */
export function PlayerProfileForm({ games, initial }: Props) {
  const t = useTranslations("player");
  const router = useRouter();
  const [dob, setDob] = useState(initial.dateOfBirth);
  const [favorites, setFavorites] = useState<string[]>(initial.favoriteGames);
  const [ids, setIds] = useState<Record<string, string>>(initial.playerIds);
  const [guardianName, setGuardianName] = useState(initial.guardianName);
  const [guardianEmail, setGuardianEmail] = useState(initial.guardianEmail);
  const [guardianPhone, setGuardianPhone] = useState(initial.guardianPhone);
  const [consentAt, setConsentAt] = useState<string | null>(initial.guardianConsentAt);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [sending, startSending] = useTransition();

  const parsedDob = useMemo(() => parseDateOfBirth(dob), [dob]);
  const age = parsedDob ? ageOn(parsedDob) : null;
  const minor = parsedDob ? isMinor(parsedDob) : false;
  const guardianDirty =
    guardianEmail.trim().toLowerCase() !== initial.guardianEmail.trim().toLowerCase();
  const consentGiven = !!consentAt && !guardianDirty;

  function toggleFavorite(key: string) {
    setFavorites((f) => (f.includes(key) ? f.filter((k) => k !== key) : [...f, key]));
  }

  function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData();
    fd.set("dateOfBirth", dob);
    for (const k of favorites) fd.append("favoriteGames", k);
    for (const g of games) {
      if (g.playerIdLabel) fd.set(`playerId:${g.key}`, ids[g.key] ?? "");
    }
    fd.set("guardianName", guardianName);
    fd.set("guardianEmail", guardianEmail);
    fd.set("guardianPhone", guardianPhone);
    startTransition(async () => {
      const res = await updatePlayerProfile(fd);
      if (res && "error" in res && res.error) {
        setError(res.error);
        return;
      }
      if (res && "needsConsent" in res && res.needsConsent) setConsentAt(null);
      toast.success(t("saved"));
      router.refresh();
    });
  }

  function sendConsent() {
    setError(null);
    startSending(async () => {
      const res = await requestGuardianConsent();
      if ("error" in res && res.error) {
        setError(res.error);
        return;
      }
      toast.success(t("consentSent", { email: ("email" in res && res.email) || "" }));
    });
  }

  const enabledGames = games.filter((g) => g.enabled);

  return (
    <form onSubmit={save} className="space-y-6">
      <FieldRow label={t("dateOfBirth")} hint={t("dateOfBirthHint")} htmlFor="dateOfBirth">
        <div className="space-y-1.5">
          <div className="relative">
            <Cake className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              id="dateOfBirth"
              type="date"
              value={dob}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setDob(e.target.value)}
              className={`${INPUT} pl-9`}
            />
          </div>
          {age !== null && (
            <p className="text-xs text-muted-foreground">
              {t("ageLine", { age })}
              {minor ? ` ${t("minorNote", { age: GUARDIAN_CONSENT_AGE })}` : ""}
            </p>
          )}
        </div>
      </FieldRow>

      <FieldRow label={t("favoriteGames")} hint={t("favoriteGamesHint")}>
        <div className="flex flex-wrap gap-2">
          {enabledGames.map((g) => {
            const on = favorites.includes(g.key);
            return (
              <button
                key={g.key}
                type="button"
                onClick={() => toggleFavorite(g.key)}
                aria-pressed={on}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                  on
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-foreground hover:bg-muted"
                }`}
              >
                {on && <Check className="size-3.5" />}
                {g.name}
              </button>
            );
          })}
        </div>
      </FieldRow>

      {enabledGames.some((g) => g.playerIdLabel && favorites.includes(g.key)) && (
        <FieldRow label={t("playerIds")} hint={t("playerIdsHint")}>
          <div className="space-y-3">
            {enabledGames
              .filter((g) => g.playerIdLabel && favorites.includes(g.key))
              .map((g) => (
                <div key={g.key}>
                  <label htmlFor={`pid-${g.key}`} className="mb-1 block text-xs font-medium text-muted-foreground">
                    {g.playerIdLabel}
                  </label>
                  <input
                    id={`pid-${g.key}`}
                    type="text"
                    value={ids[g.key] ?? ""}
                    onChange={(e) => setIds((p) => ({ ...p, [g.key]: e.target.value }))}
                    maxLength={40}
                    className={INPUT}
                    autoComplete="off"
                  />
                </div>
              ))}
          </div>
        </FieldRow>
      )}

      {minor && (
        <FieldRow label={t("guardian")} hint={t("guardianHint")}>
          <div className="space-y-3">
            <input
              type="text"
              value={guardianName}
              onChange={(e) => setGuardianName(e.target.value)}
              placeholder={t("guardianName")}
              className={INPUT}
              maxLength={100}
            />
            <input
              type="email"
              value={guardianEmail}
              onChange={(e) => setGuardianEmail(e.target.value)}
              placeholder={t("guardianEmail")}
              className={INPUT}
              required
            />
            <input
              type="tel"
              value={guardianPhone}
              onChange={(e) => setGuardianPhone(e.target.value)}
              placeholder={t("guardianPhone")}
              className={INPUT}
              required
            />

            <div
              className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm ${
                consentGiven
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200"
              }`}
            >
              <span className="inline-flex items-center gap-2">
                {consentGiven ? <ShieldCheck className="size-4" /> : <Mail className="size-4" />}
                {consentGiven ? t("consentGiven") : t("consentMissing")}
              </span>
              {!consentGiven && (
                <button
                  type="button"
                  onClick={sendConsent}
                  disabled={sending || guardianDirty || !initial.guardianEmail}
                  title={guardianDirty || !initial.guardianEmail ? t("consentSaveFirst") : undefined}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                >
                  {sending ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                  {t("consentSend")}
                </button>
              )}
            </div>
          </div>
        </FieldRow>
      )}

      {error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover disabled:opacity-50"
        >
          {pending && <Loader2 className="size-4 animate-spin" />}
          {t("save")}
        </button>
      </div>
    </form>
  );
}
