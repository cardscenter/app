"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { suspendUser, liftSuspension } from "@/actions/admin-suspension";
import {
  resetIbanCooldown,
  forceUsernameReset,
  grantTier,
  revokeTier,
  adminChangeUsername,
  adminChangeFullName,
} from "@/actions/admin/users";
import { ACCOUNT_TIERS, type BillingCycle } from "@/lib/subscription-tiers";
import { Ban, ShieldOff, RotateCcw, UserCog, CreditCard, X, Crown, CircleMinus, IdCard } from "lucide-react";

type Props = {
  userId: string;
  userName: string;
  accountType: string;
  isSuspended: boolean;
  hasIban: boolean;
  hasUsernameCooldown: boolean;
  firstName: string | null;
  lastName: string | null;
};

type GrantableTier = "PRO" | "UNLIMITED" | "ENTERPRISE";
const GRANTABLE: GrantableTier[] = ["PRO", "UNLIMITED", "ENTERPRISE"];
const TIER_LABEL: Record<GrantableTier, string> = { PRO: "Pro", UNLIMITED: "Unlimited", ENTERPRISE: "Enterprise" };

export function UserActionBar({ userId, userName, accountType, isSuspended, hasIban, hasUsernameCooldown, firstName, lastName }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [suspendType, setSuspendType] = useState<"TEMPORARY" | "PERMANENT">("TEMPORARY");
  const [days, setDays] = useState("7");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Tier toekennen / intrekken (Fase 45)
  const [tierOpen, setTierOpen] = useState(false);
  const [tier, setTier] = useState<GrantableTier>("PRO");
  const [cycle, setCycle] = useState<BillingCycle>("MONTHLY");
  const [customPrice, setCustomPrice] = useState(String(ACCOUNT_TIERS.ENTERPRISE.monthlyPrice));
  const [tierReason, setTierReason] = useState("");
  const [tierError, setTierError] = useState<string | null>(null);
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [revokeReason, setRevokeReason] = useState("");
  const [revokeError, setRevokeError] = useState<string | null>(null);

  const isAdminAccount = accountType === "ADMIN";
  const hasPaidTier = accountType === "PRO" || accountType === "UNLIMITED" || accountType === "ENTERPRISE";

  function handleSuspend(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (reason.trim().length < 5) {
      setError("Reden minimaal 5 tekens.");
      return;
    }
    const fd = new FormData();
    fd.set("type", suspendType);
    fd.set("reason", reason.trim());
    if (suspendType === "TEMPORARY") fd.set("days", days);
    startTransition(async () => {
      const res = await suspendUser(userId, fd);
      if ("error" in res) {
        setError(res.error ?? null);
      } else {
        setSuspendOpen(false);
        setReason("");
        router.refresh();
      }
    });
  }

  function handleLift() {
    if (!confirm(`Weet je zeker dat je de opschorting van ${userName} wilt opheffen?`)) return;
    startTransition(async () => {
      const res = await liftSuspension(userId);
      if ("error" in res) alert(res.error);
      else router.refresh();
    });
  }

  function handleResetIban() {
    if (!confirm(`Reset IBAN-cooldown voor ${userName}?`)) return;
    startTransition(async () => {
      const res = await resetIbanCooldown(userId);
      if ("error" in res) alert(res.error);
      else router.refresh();
    });
  }

  function handleResetUsername() {
    if (!confirm(`Geef ${userName} zijn eenmalige naamswijziging terug?`)) return;
    startTransition(async () => {
      const res = await forceUsernameReset(userId);
      if ("error" in res) alert(res.error);
      else router.refresh();
    });
  }

  function handleGrantTier(e: React.FormEvent) {
    e.preventDefault();
    setTierError(null);
    if (tierReason.trim().length < 5) {
      setTierError("Reden minimaal 5 tekens.");
      return;
    }
    const price = tier === "ENTERPRISE" ? Number(customPrice.replace(",", ".")) : undefined;
    if (tier === "ENTERPRISE" && (!Number.isFinite(price) || (price ?? 0) <= 0)) {
      setTierError("Voer een geldige maandprijs in.");
      return;
    }
    startTransition(async () => {
      const res = await grantTier({
        userId,
        tier,
        billingCycle: cycle,
        customMonthlyPrice: price,
        reason: tierReason.trim(),
      });
      if ("error" in res) {
        setTierError(res.error ?? null);
      } else {
        setTierOpen(false);
        setTierReason("");
        router.refresh();
      }
    });
  }

  function handleRevokeTier(e: React.FormEvent) {
    e.preventDefault();
    setRevokeError(null);
    if (revokeReason.trim().length < 5) {
      setRevokeError("Reden minimaal 5 tekens.");
      return;
    }
    startTransition(async () => {
      const res = await revokeTier(userId, revokeReason.trim());
      if ("error" in res) {
        setRevokeError(res.error ?? null);
      } else {
        setRevokeOpen(false);
        setRevokeReason("");
        router.refresh();
      }
    });
  }

  // Naam wijzigen na ID-controle (sept 2026): gebruikers mogen hun eigen naam
  // maar één keer wijzigen, dus dit is daarna de enige route.
  const [nameOpen, setNameOpen] = useState(false);
  const [newUsername, setNewUsername] = useState(userName);
  const [newFirstName, setNewFirstName] = useState(firstName ?? "");
  const [newLastName, setNewLastName] = useState(lastName ?? "");
  const [nameReason, setNameReason] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);

  function handleChangeName(e: React.FormEvent) {
    e.preventDefault();
    setNameError(null);
    const reasonTrimmed = nameReason.trim();
    if (reasonTrimmed.length < 5) {
      setNameError("Reden minimaal 5 tekens — noteer hier de ID-controle.");
      return;
    }
    const usernameChanged = newUsername.trim() !== userName;
    const fullNameChanged =
      newFirstName.trim() !== (firstName ?? "") || newLastName.trim() !== (lastName ?? "");
    if (!usernameChanged && !fullNameChanged) {
      setNameError("Er is niets gewijzigd.");
      return;
    }
    startTransition(async () => {
      if (usernameChanged) {
        const res = await adminChangeUsername(userId, newUsername.trim(), reasonTrimmed);
        if ("error" in res) {
          setNameError(res.error ?? null);
          return;
        }
      }
      if (fullNameChanged) {
        const res = await adminChangeFullName(
          userId,
          newFirstName.trim(),
          newLastName.trim(),
          reasonTrimmed,
        );
        if ("error" in res) {
          setNameError(res.error ?? null);
          return;
        }
      }
      setNameOpen(false);
      setNameReason("");
      router.refresh();
    });
  }

  const inputCls = "w-full rounded-md border border-border bg-card px-3 py-1.5 text-sm";

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {isSuspended ? (
          <button
            onClick={handleLift}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            <ShieldOff className="h-4 w-4" /> Hef opschorting op
          </button>
        ) : (
          <button
            onClick={() => setSuspendOpen(true)}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-md bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
          >
            <Ban className="h-4 w-4" /> Opschorten
          </button>
        )}

        {!isAdminAccount && (
          <button
            onClick={() => setTierOpen(true)}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-md bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
          >
            <Crown className="h-4 w-4" /> Tier toekennen
          </button>
        )}

        {hasPaidTier && (
          <button
            onClick={() => setRevokeOpen(true)}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            <CircleMinus className="h-4 w-4" /> Tier intrekken
          </button>
        )}

        <Link
          href={`/dashboard/admin/bank-transfers?q=${encodeURIComponent(userName)}`}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium hover:bg-muted"
        >
          <CreditCard className="h-4 w-4" /> Bevestig storting
        </Link>

        <button
          onClick={() => setNameOpen(true)}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium hover:bg-muted disabled:opacity-50"
        >
          <IdCard className="h-4 w-4" /> Naam wijzigen
        </button>

        {hasIban && (
          <button
            onClick={handleResetIban}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            <RotateCcw className="h-4 w-4" /> Reset IBAN-cooldown
          </button>
        )}

        {hasUsernameCooldown && (
          <button
            onClick={handleResetUsername}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            <UserCog className="h-4 w-4" /> Geef naamswijziging terug
          </button>
        )}
      </div>

      {nameOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <form
            onSubmit={handleChangeName}
            className="w-full max-w-md space-y-3 rounded-dash border border-border bg-card p-5 shadow-lg"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-[15px] font-semibold">Naam wijzigen: {userName}</h3>
              <button
                type="button"
                onClick={() => setNameOpen(false)}
                className="rounded-md p-1 hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="rounded-md border border-amber-300/70 bg-amber-50 p-2.5 text-xs leading-relaxed text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
              Alleen wijzigen na controle van een geldig identiteitsbewijs. De oude
              gebruikersnaam blijft publiek zichtbaar op het profiel. Beide naamvelden
              leegmaken geeft de gebruiker het naamveld weer vrij.
            </p>
            <div className="space-y-2">
              <label className="text-sm font-medium">Gebruikersnaam</label>
              <input
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                className={inputCls}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Voornaam</label>
                <input
                  type="text"
                  value={newFirstName}
                  onChange={(e) => setNewFirstName(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Achternaam</label>
                <input
                  type="text"
                  value={newLastName}
                  onChange={(e) => setNewLastName(e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Onderbouwing (audit-log)</label>
              <textarea
                value={nameReason}
                onChange={(e) => setNameReason(e.target.value)}
                rows={3}
                placeholder="Bijv. ID gecontroleerd, ticket #123"
                className={inputCls}
              />
            </div>
            {nameError && <p className="text-xs text-rose-600">{nameError}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setNameOpen(false)}
                className="rounded-md border border-border bg-card px-3 py-1.5 text-sm hover:bg-muted"
              >
                Annuleer
              </button>
              <button
                type="submit"
                disabled={pending}
                className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
              >
                {pending ? "Bezig…" : "Wijzig naam"}
              </button>
            </div>
          </form>
        </div>
      )}

      {suspendOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <form
            onSubmit={handleSuspend}
            className="w-full max-w-md space-y-3 rounded-dash border border-border bg-card p-5 shadow-lg"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-[15px] font-semibold">Opschorten: {userName}</h3>
              <button
                type="button"
                onClick={() => setSuspendOpen(false)}
                className="rounded-md p-1 hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Type</label>
              <div className="flex gap-2">
                {(["TEMPORARY", "PERMANENT"] as const).map((t) => (
                  <label key={t} className="flex flex-1 cursor-pointer items-center gap-2 rounded-md border border-border p-2 text-sm hover:bg-muted/40">
                    <input
                      type="radio"
                      name="type"
                      value={t}
                      checked={suspendType === t}
                      onChange={() => setSuspendType(t)}
                    />
                    {t === "TEMPORARY" ? "Tijdelijk" : "Permanent"}
                  </label>
                ))}
              </div>
            </div>
            {suspendType === "TEMPORARY" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Aantal dagen (1-365)</label>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={days}
                  onChange={(e) => setDays(e.target.value)}
                  className={inputCls}
                />
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium">Reden (zichtbaar voor user)</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="Min. 5 tekens"
                className={inputCls}
              />
            </div>
            {error && <p className="text-xs text-rose-600">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSuspendOpen(false)}
                className="rounded-md border border-border bg-card px-3 py-1.5 text-sm hover:bg-muted"
              >
                Annuleer
              </button>
              <button
                type="submit"
                disabled={pending}
                className="rounded-md bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {pending ? "Bezig…" : "Opschorten"}
              </button>
            </div>
          </form>
        </div>
      )}

      {tierOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <form
            onSubmit={handleGrantTier}
            className="w-full max-w-md space-y-3 rounded-dash border border-border bg-card p-5 shadow-lg"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-[15px] font-semibold">Tier toekennen: {userName}</h3>
              <button type="button" onClick={() => setTierOpen(false)} className="rounded-md p-1 hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Huidig: <span className="font-medium text-foreground">{accountType}</span>. Toekennen zet accountType,
              zoekboost, gratis spotlight-quota en een Subscription-rij; de tier verloopt na de gekozen cyclus
              (check-subscriptions-cron) tenzij opnieuw toegekend.
            </p>
            <div className="space-y-2">
              <label className="text-sm font-medium">Tier</label>
              <div className="flex gap-2">
                {GRANTABLE.map((t) => (
                  <label key={t} className="flex flex-1 cursor-pointer items-center gap-2 rounded-md border border-border p-2 text-sm hover:bg-muted/40">
                    <input type="radio" name="tier" value={t} checked={tier === t} onChange={() => setTier(t)} />
                    <span>
                      {TIER_LABEL[t]}
                      <span className="block text-[11px] text-muted-foreground">
                        €{ACCOUNT_TIERS[t].monthlyPrice.toFixed(2).replace(".", ",")}/m
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Cyclus</label>
              <div className="flex gap-2">
                {(["MONTHLY", "YEARLY"] as const).map((c) => (
                  <label key={c} className="flex flex-1 cursor-pointer items-center gap-2 rounded-md border border-border p-2 text-sm hover:bg-muted/40">
                    <input type="radio" name="cycle" value={c} checked={cycle === c} onChange={() => setCycle(c)} />
                    {c === "MONTHLY" ? "Maandelijks (1 maand)" : "Jaarlijks (1 jaar)"}
                  </label>
                ))}
              </div>
            </div>
            {tier === "ENTERPRISE" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Maandprijs (€, custom mogelijk)</label>
                <input
                  type="number"
                  min={1}
                  step="0.01"
                  value={customPrice}
                  onChange={(e) => setCustomPrice(e.target.value)}
                  className={inputCls}
                />
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium">Reden (intern, audit-log)</label>
              <textarea
                value={tierReason}
                onChange={(e) => setTierReason(e.target.value)}
                rows={2}
                placeholder="Bv. handmatige betaling ontvangen / testaccount"
                className={inputCls}
              />
            </div>
            {tierError && <p className="text-xs text-rose-600">{tierError}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setTierOpen(false)} className="rounded-md border border-border bg-card px-3 py-1.5 text-sm hover:bg-muted">
                Annuleer
              </button>
              <button type="submit" disabled={pending} className="rounded-md bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50">
                {pending ? "Bezig…" : `Toekennen: ${TIER_LABEL[tier]}`}
              </button>
            </div>
          </form>
        </div>
      )}

      {revokeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <form
            onSubmit={handleRevokeTier}
            className="w-full max-w-md space-y-3 rounded-dash border border-border bg-card p-5 shadow-lg"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-[15px] font-semibold">Tier intrekken: {userName}</h3>
              <button type="button" onClick={() => setRevokeOpen(false)} className="rounded-md p-1 hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Zet <span className="font-medium text-foreground">{accountType}</span> direct terug naar FREE: zoekboost
              uit, gratis spotlight-quota op 0, actieve Subscription geannuleerd. Winkel-URL en winkelpagina blijven
              bewaard maar zijn niet meer bereikbaar.
            </p>
            <div className="space-y-2">
              <label className="text-sm font-medium">Reden (intern, audit-log)</label>
              <textarea
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                rows={2}
                placeholder="Min. 5 tekens"
                className={inputCls}
              />
            </div>
            {revokeError && <p className="text-xs text-rose-600">{revokeError}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setRevokeOpen(false)} className="rounded-md border border-border bg-card px-3 py-1.5 text-sm hover:bg-muted">
                Annuleer
              </button>
              <button type="submit" disabled={pending} className="rounded-md bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50">
                {pending ? "Bezig…" : "Intrekken"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
