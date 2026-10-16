"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { updateBulkPrice } from "@/actions/admin/buyback-pricing";
import type { BulkPriceRow } from "@/lib/buyback-pricing-db";

const INPUT = "glass-input w-full rounded-md px-2 py-1.5 text-sm";

function Row({ row }: { row: BulkPriceRow }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [form, setForm] = useState({ name: row.name, nameEn: row.nameEn, description: row.description ?? "", price: row.price, weightGrams: row.weightGrams, sortOrder: row.sortOrder, enabled: row.enabled });
  const dirty = JSON.stringify(form) !== JSON.stringify({ name: row.name, nameEn: row.nameEn, description: row.description ?? "", price: row.price, weightGrams: row.weightGrams, sortOrder: row.sortOrder, enabled: row.enabled });
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  function save() {
    start(async () => {
      const r = await updateBulkPrice(row.key, form);
      if ("error" in r) return void toast.error(r.error);
      toast.success(`${form.name} opgeslagen`);
      router.refresh();
    });
  }

  return (
    <tr className={form.enabled ? "" : "opacity-60"}>
      <td className="px-3 py-2 align-top">
        <code className="text-[11px] text-muted-foreground">{row.key}</code>
        <p className="text-[11px] text-muted-foreground">{row.group === "pokemon" ? "Pokémon" : "Overig"}</p>
      </td>
      <td className="px-2 py-2 align-top">
        <input value={form.name} onChange={(e) => set("name", e.target.value)} className={INPUT} maxLength={60} />
        <input value={form.nameEn} onChange={(e) => set("nameEn", e.target.value)} className={`${INPUT} mt-1`} maxLength={60} placeholder="Engels" />
      </td>
      <td className="px-2 py-2 align-top"><input value={form.description} onChange={(e) => set("description", e.target.value)} className={INPUT} maxLength={200} placeholder="Toelichting (optioneel)" /></td>
      <td className="px-2 py-2 align-top"><input type="number" step="0.01" min={0} max={1000} value={form.price} onChange={(e) => set("price", Number(e.target.value))} className={`${INPUT} w-24 text-right tabular-nums`} /></td>
      <td className="px-2 py-2 align-top"><input type="number" step="0.1" min={0.1} max={5000} value={form.weightGrams} onChange={(e) => set("weightGrams", Number(e.target.value))} className={`${INPUT} w-20 text-right`} /></td>
      <td className="px-2 py-2 align-top"><input type="number" min={0} max={10000} value={form.sortOrder} onChange={(e) => set("sortOrder", Number(e.target.value))} className={`${INPUT} w-16 text-right`} /></td>
      <td className="px-2 py-2 align-top text-center"><input type="checkbox" checked={form.enabled} onChange={(e) => set("enabled", e.target.checked)} className="size-4 accent-primary" /></td>
      <td className="px-2 py-2 align-top text-right">
        <button type="button" onClick={save} disabled={pending || !dirty} className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-40">
          <Save className="size-3.5" /> Opslaan
        </button>
      </td>
    </tr>
  );
}

/** Tarieftabel bulk-inkoop: prijs, naam (nl/en), toelichting, gewicht, volgorde, aan/uit. */
export function BulkPricingAdmin({ rows }: { rows: BulkPriceRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left">Sleutel</th>
            <th className="px-2 py-2 text-left">Naam (nl / en)</th>
            <th className="px-2 py-2 text-left">Toelichting</th>
            <th className="px-2 py-2 text-right">Prijs per stuk</th>
            <th className="px-2 py-2 text-right">Gram</th>
            <th className="px-2 py-2 text-right">Volgorde</th>
            <th className="px-2 py-2">Aan</th>
            <th className="px-2 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => (
            <Row key={r.key} row={r} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
