"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, X, Loader2 } from "lucide-react";
import { checkUsernameAvailable, type UsernameCheckReason } from "@/actions/username-check";

interface UsernameAvailabilityIndicatorProps {
  displayName: string;
  /** Debounce in ms voordat de server-call gedaan wordt. Default 500. */
  debounceMs?: number;
}

type Status =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "available" }
  | { kind: "unavailable"; reason: UsernameCheckReason };

const REASON_KEY: Record<UsernameCheckReason, string> = {
  TOO_SHORT: "usernameReasonTooShort",
  TOO_LONG: "usernameReasonTooLong",
  INVALID_CHARS: "usernameReasonInvalidChars",
  RESERVED: "usernameReasonReserved",
  NOT_ALLOWED: "usernameReasonNotAllowed",
  TAKEN: "usernameReasonTaken",
};

/**
 * Live-availability indicator achter het displayName-veld op register-form.
 * Debounced check tegen de server, toont loader / groen-vinkje / rood-kruis
 * + reden-tekst onder het veld.
 */
export function UsernameAvailabilityIndicator({
  displayName,
  debounceMs = 500,
}: UsernameAvailabilityIndicatorProps) {
  const t = useTranslations("auth");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  useEffect(() => {
    const trimmed = displayName.trim();

    // Onder de minimum-lengte tonen we niets — gebruiker is nog aan het typen.
    if (trimmed.length < 3) {
      setStatus({ kind: "idle" });
      return;
    }

    setStatus({ kind: "checking" });

    const timer = setTimeout(async () => {
      try {
        const result = await checkUsernameAvailable(trimmed);
        if (result.available) {
          setStatus({ kind: "available" });
        } else {
          setStatus({ kind: "unavailable", reason: result.reason ?? "TAKEN" });
        }
      } catch {
        // Stille faal — netwerk-error o.i.d. We blokkeren de form niet.
        setStatus({ kind: "idle" });
      }
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [displayName, debounceMs]);

  if (status.kind === "idle") return null;

  if (status.kind === "checking") {
    return (
      <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="size-3 animate-spin" />
        {t("usernameChecking")}
      </p>
    );
  }

  if (status.kind === "available") {
    return (
      <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
        <Check className="size-3.5" />
        {t("usernameAvailable")}
      </p>
    );
  }

  return (
    <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-red-600 dark:text-red-400">
      <X className="size-3.5" />
      {t(REASON_KEY[status.reason])}
    </p>
  );
}
