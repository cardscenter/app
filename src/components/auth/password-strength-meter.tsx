"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

interface PasswordStrengthMeterProps {
  password: string;
}

type Strength = 0 | 1 | 2 | 3 | 4;

/**
 * Simpele password-strength heuristiek (geen zxcvbn-dependency).
 * Scoort op length + char-variety, returnt 0–4. Hint geeft de eerstvolgende
 * verbetering aan.
 */
function scorePassword(password: string): { strength: Strength; hintKey: string } {
  if (!password) return { strength: 0, hintKey: "strengthHintLength" };

  const length = password.length;
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSymbol = /[^a-zA-Z0-9]/.test(password);

  // Eerst de minimum-length-check
  if (length < 8) {
    return { strength: 1, hintKey: "strengthHintLength" };
  }

  // Score op variety: 1 punt per char-klasse (max 4)
  const varietyScore = [hasLower, hasUpper, hasNumber, hasSymbol].filter(Boolean).length;

  // Combineer length-bonus met variety
  let strength: Strength = 1;
  if (length >= 8 && varietyScore >= 2) strength = 2;
  if (length >= 10 && varietyScore >= 3) strength = 3;
  if (length >= 12 && varietyScore >= 4) strength = 4;

  // Hint kiezen op basis van wat er nog te winnen valt
  let hintKey = "strengthHintStrong";
  if (strength < 4) {
    if (!hasUpper) hintKey = "strengthHintUppercase";
    else if (!hasNumber) hintKey = "strengthHintNumber";
    else if (!hasSymbol) hintKey = "strengthHintSymbol";
    else if (length < 12) hintKey = "strengthHintLonger";
    else hintKey = "strengthHintStrong";
  }

  return { strength, hintKey };
}

const SEGMENT_COLORS: Record<Strength, string> = {
  0: "bg-muted",
  1: "bg-red-500",
  2: "bg-amber-500",
  3: "bg-yellow-500",
  4: "bg-emerald-500",
};

const LABEL_KEYS: Record<Strength, string> = {
  0: "strengthLabelEmpty",
  1: "strengthLabelWeak",
  2: "strengthLabelOk",
  3: "strengthLabelGood",
  4: "strengthLabelStrong",
};

export function PasswordStrengthMeter({ password }: PasswordStrengthMeterProps) {
  const t = useTranslations("auth");
  const { strength, hintKey } = useMemo(() => scorePassword(password), [password]);

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex gap-1.5">
        {[1, 2, 3, 4].map((segment) => (
          <div
            key={segment}
            className={`h-1 flex-1 rounded-full transition-colors ${
              strength >= segment ? SEGMENT_COLORS[strength] : "bg-muted"
            }`}
          />
        ))}
      </div>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-medium text-foreground">{t(LABEL_KEYS[strength])}</span>
        {password.length > 0 && (
          <span className="text-muted-foreground">{t(hintKey)}</span>
        )}
      </div>
    </div>
  );
}
