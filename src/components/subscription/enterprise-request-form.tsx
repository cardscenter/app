"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { Loader2 } from "lucide-react";
import { submitEnterpriseRequest } from "@/actions/enterprise";
import { ENTERPRISE_MIN_MONTHLY_REVENUE } from "@/lib/subscription-tiers";

export function EnterpriseRequestForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      const result = await submitEnterpriseRequest(formData);
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <form action={handleSubmit} className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-card">
      <h2 className="text-base font-semibold text-foreground">Vertel ons over je shop</h2>

      <Field label="Winkel-/bedrijfsnaam" name="shopName" required>
        <input
          type="text"
          name="shopName"
          required
          maxLength={100}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
        />
      </Field>

      <Field
        label={`Geschatte maandomzet (min €${ENTERPRISE_MIN_MONTHLY_REVENUE.toLocaleString("nl-NL")})`}
        name="estimatedMonthlyRevenue"
        required
      >
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">€</span>
          <input
            type="number"
            name="estimatedMonthlyRevenue"
            min={ENTERPRISE_MIN_MONTHLY_REVENUE}
            step={500}
            required
            className="w-full rounded-lg border border-border bg-background py-2 pl-7 pr-3 text-sm text-foreground outline-none focus:border-primary"
          />
        </div>
      </Field>

      <Field label="Telefoonnummer" name="phone" required>
        <input
          type="tel"
          name="phone"
          required
          maxLength={30}
          placeholder="+31 6 12345678"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
        />
      </Field>

      <Field
        label="Vertel kort wat voor shop je hebt en wat je nodig hebt"
        name="motivation"
        required
        hint="Bijv. soort verzameling, huidige kanalen, wat zou je van Cards Center verwachten."
      >
        <textarea
          name="motivation"
          required
          minLength={20}
          maxLength={2000}
          rows={5}
          className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
        />
      </Field>

      {error && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-3 text-sm text-rose-600 dark:text-rose-400">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-lg bg-violet-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-violet-600 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Verzenden...
          </span>
        ) : (
          "Aanvraag verzenden"
        )}
      </button>

      <p className="text-xs text-muted-foreground">
        Je gegevens worden alleen gebruikt om contact met je op te nemen over je aanvraag. We nemen meestal binnen 3 werkdagen contact op.
      </p>
    </form>
  );
}

function Field({
  label,
  name,
  required,
  hint,
  children,
}: {
  label: string;
  name: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="block text-sm font-medium text-foreground">
        {label}
        {required && <span className="ml-1 text-rose-500">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
