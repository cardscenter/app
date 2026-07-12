"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Shield, Loader2, Copy, Check } from "lucide-react";
import {
  startTotpEnrollment,
  confirmTotpEnrollment,
  disableTotp,
} from "@/actions/two-factor";

type Step = "idle" | "scan" | "backup" | "disable";

/**
 * 2FA-beheer op /dashboard/profiel (Fase 16-followup).
 * Flow: Instellen → QR scannen in Google Authenticator → 6-cijfer code
 * bevestigen → backup-codes tonen (eenmalig). Uitzetten = wachtwoord + code.
 */
export function TwoFactorSettings({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("idle");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleStart() {
    setError(null);
    startTransition(async () => {
      const result = await startTotpEnrollment();
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setQrDataUrl(result.qrDataUrl);
      setSecret(result.secret);
      setStep("scan");
    });
  }

  function handleConfirm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const code = new FormData(e.currentTarget).get("code") as string;
    startTransition(async () => {
      const result = await confirmTotpEnrollment(code);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setBackupCodes(result.backupCodes);
      setStep("backup");
    });
  }

  function handleDisable(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await disableTotp(formData);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setStep("idle");
      router.refresh();
    });
  }

  function handleCopyBackupCodes() {
    if (!backupCodes) return;
    navigator.clipboard.writeText(backupCodes.join("\n")).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const inputClass =
    "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40";

  return (
    <div className="rounded-lg border border-border bg-muted/20">
      {/* Kop-rij */}
      <div className="flex items-center justify-between gap-4 px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-3">
          <span className={enabled ? "text-emerald-500" : "text-muted-foreground"}>
            {enabled ? <ShieldCheck className="size-4" /> : <Shield className="size-4" />}
          </span>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Twee-factor-authenticatie (2FA)</p>
            <p className="truncate text-sm font-medium text-foreground">
              {enabled ? (
                <span className="text-emerald-600 dark:text-emerald-400">Ingeschakeld</span>
              ) : (
                "Uitgeschakeld"
              )}
            </p>
          </div>
        </div>
        <div className="shrink-0">
          {enabled ? (
            <button
              type="button"
              onClick={() => {
                setStep(step === "disable" ? "idle" : "disable");
                setError(null);
              }}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {step === "disable" ? "Annuleren" : "Uitzetten"}
            </button>
          ) : step === "idle" ? (
            <button
              type="button"
              onClick={handleStart}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary-hover transition-colors disabled:opacity-60"
            >
              {isPending && <Loader2 className="size-3.5 animate-spin" />}
              Instellen
            </button>
          ) : step === "scan" ? (
            <button
              type="button"
              onClick={() => {
                setStep("idle");
                setError(null);
              }}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Annuleren
            </button>
          ) : null}
        </div>
      </div>

      {error && (
        <p className="mx-3 mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {/* Stap 1 — QR scannen + code bevestigen */}
      {step === "scan" && qrDataUrl && (
        <div className="space-y-3 border-t border-border px-3 py-3">
          <p className="text-sm text-foreground">
            <strong>1.</strong> Scan deze QR-code met Google Authenticator (of een andere
            authenticator-app):
          </p>
          <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-start sm:gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrDataUrl}
              alt="2FA QR-code"
              width={160}
              height={160}
              className="rounded-lg border border-border bg-white p-2"
            />
            <div className="text-xs text-muted-foreground">
              <p className="mb-1">Kun je niet scannen? Voer deze sleutel handmatig in:</p>
              <code className="block break-all rounded bg-muted px-2 py-1 font-mono text-[11px] text-foreground">
                {secret}
              </code>
            </div>
          </div>
          <form onSubmit={handleConfirm} className="space-y-2">
            <p className="text-sm text-foreground">
              <strong>2.</strong> Vul de 6-cijferige code uit de app in:
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                name="code"
                inputMode="numeric"
                pattern="[0-9\s]{6,7}"
                maxLength={7}
                required
                autoFocus
                placeholder="123456"
                className={`${inputClass} max-w-[10rem] text-center tracking-[0.25em]`}
              />
              <button
                type="submit"
                disabled={isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-60"
              >
                {isPending && <Loader2 className="size-4 animate-spin" />}
                Bevestigen
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Stap 2 — backup-codes (eenmalig zichtbaar) */}
      {step === "backup" && backupCodes && (
        <div className="space-y-3 border-t border-border px-3 py-3">
          <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
            ✅ 2FA staat aan!
          </p>
          <p className="text-sm text-foreground">
            Bewaar deze <strong>backup-codes</strong> op een veilige plek (wachtwoordmanager,
            print). Elke code werkt één keer — gebruik ze als je je telefoon kwijt bent.{" "}
            <strong>Ze worden maar één keer getoond.</strong>
          </p>
          <div className="grid grid-cols-2 gap-1.5 rounded-lg border border-border bg-muted px-3 py-2 font-mono text-sm text-foreground sm:grid-cols-4">
            {backupCodes.map((c) => (
              <span key={c}>{c}</span>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleCopyBackupCodes}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary-hover transition-colors"
            >
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              {copied ? "Gekopieerd" : "Kopieer alle codes"}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep("idle");
                setBackupCodes(null);
                router.refresh();
              }}
              className="inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
            >
              Ik heb ze opgeslagen
            </button>
          </div>
        </div>
      )}

      {/* Uitzetten — wachtwoord + code */}
      {step === "disable" && (
        <form onSubmit={handleDisable} className="space-y-3 border-t border-border px-3 py-3">
          <p className="text-sm text-muted-foreground">
            Bevestig met je wachtwoord en een geldige 2FA- of backup-code.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Wachtwoord
              </label>
              <input
                type="password"
                name="password"
                required
                autoComplete="current-password"
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                2FA- of backup-code
              </label>
              <input
                type="text"
                name="code"
                required
                autoComplete="one-time-code"
                placeholder="123456"
                className={inputClass}
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-500/20 disabled:opacity-60 dark:text-red-400"
          >
            {isPending && <Loader2 className="size-4 animate-spin" />}
            2FA uitzetten
          </button>
        </form>
      )}
    </div>
  );
}
