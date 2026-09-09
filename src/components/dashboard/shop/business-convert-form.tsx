"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { Building2, Loader2 } from "lucide-react";
import { convertToBusinessAccount } from "@/actions/profile";

/**
 * "Zet om naar bedrijfspagina" — particulier → bedrijf (one-way). Ontgrendelt
 * de bedrijfs-only blokken en -velden van de winkelpagina.
 */
export function BusinessConvertForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [companyName, setCompanyName] = useState("");
  const [cocNumber, setCocNumber] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const fd = new FormData();
    fd.set("companyName", companyName);
    fd.set("cocNumber", cocNumber);
    fd.set("vatNumber", vatNumber);
    startTransition(async () => {
      const res = await convertToBusinessAccount(fd);
      if ("error" in res && res.error) {
        setError(res.error);
        return;
      }
      toast.success("Je account is omgezet naar een bedrijfsaccount.");
      router.refresh();
    });
  }

  const input = "mt-1 block w-full rounded-lg glass-input px-3 py-2 text-sm text-foreground";

  return (
    <form onSubmit={submit} className="max-w-lg space-y-4">
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-800 dark:text-amber-300">
        Als bedrijf krijgt je winkelpagina een <span className="font-medium">bedrijfsnaam, KvK-/btw-regel, fotogalerij,
        standplaats en openingstijden</span>. Omzetten kan niet ongedaan gemaakt worden.
      </div>
      <div>
        <label htmlFor="companyName" className="text-sm font-medium text-foreground">
          Bedrijfsnaam
        </label>
        <input id="companyName" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className={input} required maxLength={100} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="cocNumber" className="text-sm font-medium text-foreground">
            KvK- / registratienummer
          </label>
          <input id="cocNumber" value={cocNumber} onChange={(e) => setCocNumber(e.target.value)} className={input} required placeholder="12345678" />
        </div>
        <div>
          <label htmlFor="vatNumber" className="text-sm font-medium text-foreground">
            Btw-id <span className="text-muted-foreground">(optioneel)</span>
          </label>
          <input id="vatNumber" value={vatNumber} onChange={(e) => setVatNumber(e.target.value)} className={input} placeholder="NL123456789B01" />
        </div>
      </div>
      {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover disabled:opacity-50"
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Building2 className="size-4" />}
        Zet om naar bedrijfspagina
      </button>
    </form>
  );
}
