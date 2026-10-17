"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Shield, Loader2, Copy, Check } from "lucide-react";
import {
  startTotpEnrollment,
  confirmTotpEnrollment,
  disableTotp,
} from "@/actions/two-factor";
import { Callout } from "@/components/dashboard/ui/callout";
import { StatusBadge } from "@/components/dashboard/ui/status-badge";
import { buttonVariants } from "@/components/ui/button-variants";
import { INPUT } from "@/components/ploy/tile-styles";

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

  const inputClass = INPUT;

  return (
    <div>
      {/* Kop-rij: status + actie (label/uitleg komen van de FieldRow) */}
      <div className="flex items-center justify-between gap-4 rounded-[12px] border border-[var(--border)] bg-white px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2 text-sm">
          {enabled ? (
            <StatusBadge tone="success" icon={ShieldCheck}>Ingeschakeld</StatusBadge>
          ) : (
            <>
              <Shield className="size-4 text-muted-foreground" />
              <span className="text-foreground">Uitgeschakeld</span>
            </>
          )}
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
        <Callout tone="pink" className="mt-3">
          {error}
        </Callout>
      )}

      {/* Stap 1 — QR scannen + code bevestigen */}
      {step === "scan" && qrDataUrl && (
        <div className="mt-3 space-y-3 rounded-[12px] border border-[var(--border)] bg-[var(--background)] p-4">
          <p className="flex items-center gap-2 text-sm text-foreground">
            <strong>1.</strong>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/google_auth.webp" alt="Google Authenticator" width={20} height={20} className="rounded" />
            <span>
              Scan deze QR-code met Google Authenticator (of een andere authenticator-app):
            </span>
          </p>
          <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-start sm:gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrDataUrl}
              alt="2FA QR-code"
              width={160}
              height={160}
              className="rounded-[12px] border border-[var(--border)] bg-white p-2"
            />
            <div className="text-xs text-muted-foreground">
              <p className="mb-1">Kun je niet scannen? Voer deze sleutel handmatig in:</p>
              <code className="block break-all rounded-[10px] border border-[var(--border)] bg-white px-2 py-1 font-mono text-[11px] text-foreground">
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
                className={buttonVariants()}
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
        <div className="mt-3 space-y-3 rounded-[12px] border border-[var(--border)] bg-[var(--background)] p-4">
          <StatusBadge tone="success" icon={ShieldCheck}>2FA staat aan!</StatusBadge>
          <p className="text-sm text-foreground">
            Bewaar deze <strong>backup-codes</strong> op een veilige plek (wachtwoordmanager,
            print). Elke code werkt één keer. Gebruik ze als je je telefoon kwijt bent.{" "}
            <strong>Ze worden maar één keer getoond.</strong>
          </p>
          <div className="grid grid-cols-2 gap-1.5 rounded-[12px] border border-[var(--border)] bg-white px-3 py-2 font-mono text-sm text-foreground sm:grid-cols-4">
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
              className={buttonVariants()}
            >
              Ik heb ze opgeslagen
            </button>
          </div>
        </div>
      )}

      {/* Uitzetten — wachtwoord + code */}
      {step === "disable" && (
        <form onSubmit={handleDisable} className="mt-3 space-y-3 rounded-[12px] border border-[var(--border)] bg-[var(--background)] p-4">
          <p className="text-sm text-muted-foreground">
            Bevestig met je wachtwoord en een geldige 2FA- of backup-code.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground/70">
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
              <label className="mb-1 block text-xs font-medium text-foreground/70">
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
            className={buttonVariants({ variant: "destructive" })}
          >
            {isPending && <Loader2 className="size-4 animate-spin" />}
            2FA uitzetten
          </button>
        </form>
      )}
    </div>
  );
}
