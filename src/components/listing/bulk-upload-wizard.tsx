"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { Download, Upload, FileText, AlertCircle, Check, Loader2 } from "lucide-react";
import { parseCsvText, BULK_CSV_TEMPLATE, type BulkRow } from "@/lib/listing-bulk-import";
import { bulkImportListings } from "@/actions/listing";

type Step = "upload" | "preview" | "result";
interface ParsedRow {
  row: number;
  data: BulkRow;
}
interface ParsedError {
  row: number;
  field?: string;
  message: string;
}
interface ImportResult {
  createdCount: number;
  created: { row: number; listingId: string; title: string }[];
  errors: ParsedError[];
}

export function BulkUploadWizard() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("upload");
  const [csvText, setCsvText] = useState("");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [errors, setErrors] = useState<ParsedError[]>([]);
  const [filename, setFilename] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  const handleFile = async (file: File) => {
    setFilename(file.name);
    const text = await file.text();
    setCsvText(text);
    const parsed = parseCsvText(text);
    setRows(parsed.rows);
    setErrors(parsed.errors);
    setStep("preview");
  };

  const handleConfirm = () => {
    setSubmitError(null);
    startTransition(async () => {
      const r = await bulkImportListings(csvText);
      if ("error" in r && r.error) {
        setSubmitError(r.error);
        return;
      }
      setResult({
        createdCount: r.createdCount ?? 0,
        created: r.created ?? [],
        errors: r.errors ?? [],
      });
      setStep("result");
    });
  };

  const handleDownloadTemplate = () => {
    const blob = new Blob([BULK_CSV_TEMPLATE], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cards-center-bulk-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (step === "upload") {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <h2 className="mb-2 text-lg font-semibold text-foreground">1. Download het CSV-template</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Vul je listings in het template (Excel/Google Sheets), exporteer als CSV en upload hieronder.
          </p>
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/80"
          >
            <Download className="h-4 w-4" />
            Download template
          </button>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <h2 className="mb-2 text-lg font-semibold text-foreground">2. Upload je CSV</h2>
          <label
            className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/30 p-8 text-center hover:bg-muted/50"
          >
            <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Klik om CSV te selecteren</span>
            <span className="mt-1 text-xs text-muted-foreground">of sleep een bestand hierheen</span>
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
              }}
            />
          </label>
        </div>

        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-700 dark:text-amber-400">
          <p className="font-medium">Wat NIET via CSV gaat:</p>
          <ul className="mt-2 list-inside list-disc space-y-0.5 text-xs">
            <li>Foto&apos;s — voeg per listing toe via de bewerk-knop na import</li>
            <li>Card-database-koppelingen (Pokémon set/ID) — handmatig aanvullen</li>
            <li>Multi-card item-lijsten en partial-sales — gebruik de gewone form</li>
          </ul>
        </div>
      </div>
    );
  }

  if (step === "preview") {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">{filename}</h2>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Geldige rijen</p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{rows.length}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Fouten</p>
              <p className={`text-2xl font-bold ${errors.length > 0 ? "text-rose-600 dark:text-rose-400" : "text-foreground"}`}>
                {errors.length}
              </p>
            </div>
          </div>
        </div>

        {errors.length > 0 && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4">
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-rose-700 dark:text-rose-400">
              <AlertCircle className="h-4 w-4" />
              {errors.length} {errors.length === 1 ? "fout" : "fouten"}
            </h3>
            <ul className="space-y-1 text-xs text-rose-700 dark:text-rose-400">
              {errors.slice(0, 20).map((e, i) => (
                <li key={i}>
                  Rij {e.row}{e.field ? ` · ${e.field}` : ""}: {e.message}
                </li>
              ))}
              {errors.length > 20 && (
                <li className="italic">…en nog {errors.length - 20} meer</li>
              )}
            </ul>
          </div>
        )}

        {rows.length > 0 && (
          <div className="rounded-2xl border border-border bg-card shadow-card">
            <div className="border-b border-border px-4 py-3 text-sm font-medium text-foreground">
              Voorvertoning ({rows.length} {rows.length === 1 ? "rij" : "rijen"})
            </div>
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/30 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Rij</th>
                    <th className="px-3 py-2 text-left">Titel</th>
                    <th className="px-3 py-2 text-left">Type</th>
                    <th className="px-3 py-2 text-right">Prijs</th>
                    <th className="px-3 py-2 text-left">Levering</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.slice(0, 50).map((r) => (
                    <tr key={r.row}>
                      <td className="px-3 py-2 text-muted-foreground">{r.row}</td>
                      <td className="px-3 py-2 text-foreground">{r.data.title}</td>
                      <td className="px-3 py-2 text-muted-foreground text-xs">{r.data.listingType}</td>
                      <td className="px-3 py-2 text-right tabular-nums">€{r.data.price.toFixed(2)}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{r.data.deliveryMethod}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 50 && (
                <p className="border-t border-border bg-muted/20 px-3 py-2 text-center text-xs text-muted-foreground">
                  …{rows.length - 50} meer rijen niet getoond
                </p>
              )}
            </div>
          </div>
        )}

        {submitError && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-3 text-sm text-rose-600 dark:text-rose-400">
            {submitError}
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setStep("upload")}
            disabled={isPending}
            className="rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground"
          >
            Andere CSV
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isPending || rows.length === 0}
            className="flex-1 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {isPending ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Importeren...
              </span>
            ) : (
              `Importeer ${rows.length} ${rows.length === 1 ? "listing" : "listings"}`
            )}
          </button>
        </div>
      </div>
    );
  }

  // step === "result"
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6 text-center shadow-card">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
          <Check className="h-6 w-6 text-emerald-500" />
        </div>
        <h2 className="text-xl font-bold text-foreground">
          {result?.createdCount ?? 0} {result?.createdCount === 1 ? "listing" : "listings"} aangemaakt
        </h2>
        {result && result.errors.length > 0 && (
          <p className="mt-1 text-sm text-rose-600 dark:text-rose-400">
            {result.errors.length} {result.errors.length === 1 ? "rij overgeslagen" : "rijen overgeslagen"}
          </p>
        )}
        <p className="mt-3 text-sm text-muted-foreground">
          Vergeet niet om foto&apos;s en specifieke velden per listing aan te vullen via Bewerken.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <button
            type="button"
            onClick={() => {
              setStep("upload");
              setRows([]);
              setErrors([]);
              setResult(null);
              setCsvText("");
              setFilename(null);
            }}
            className="rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground"
          >
            Nog een CSV
          </button>
          <button
            type="button"
            onClick={() => router.push("/dashboard/marktplaats")}
            className="rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-white"
          >
            Naar mijn advertenties
          </button>
        </div>
      </div>

      {result && result.errors.length > 0 && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4">
          <h3 className="mb-2 text-sm font-semibold text-rose-700 dark:text-rose-400">
            Overgeslagen rijen
          </h3>
          <ul className="space-y-1 text-xs text-rose-700 dark:text-rose-400">
            {result.errors.slice(0, 30).map((e, i) => (
              <li key={i}>
                Rij {e.row}{e.field ? ` · ${e.field}` : ""}: {e.message}
              </li>
            ))}
            {result.errors.length > 30 && (
              <li className="italic">…en nog {result.errors.length - 30} meer</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
