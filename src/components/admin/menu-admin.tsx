"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { Pencil, Save, Trash2, Plus } from "lucide-react";
import { toggleMenuItem, updateMenuItem, saveDiscountCode, deleteDiscountCode } from "@/actions/admin/menu";
import type { MenuCategoryView, MenuItemView } from "@/lib/food/menu-server";
import { StatusBadge } from "@/components/dashboard/ui/status-badge";

const INPUT = "glass-input w-full rounded-md px-2.5 py-1.5 text-sm";

export function MenuAdmin({ categories, items }: { categories: MenuCategoryView[]; items: MenuItemView[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<string | null>(null);

  function toggle(id: string, field: "enabled" | "soldOut", value: boolean) {
    startTransition(async () => {
      const r = await toggleMenuItem(id, field, value);
      if ("error" in r) toast.error(String(r.error));
      router.refresh();
    });
  }

  function save(id: string, form: HTMLFormElement) {
    const fd = new FormData(form);
    startTransition(async () => {
      const r = await updateMenuItem(id, {
        name: String(fd.get("name") ?? ""),
        nameEn: String(fd.get("nameEn") ?? ""),
        description: String(fd.get("description") ?? ""),
        descriptionEn: String(fd.get("descriptionEn") ?? ""),
        price: Number(fd.get("price") ?? 0),
        enabled: fd.get("enabled") === "on",
        soldOut: fd.get("soldOut") === "on",
        tag: String(fd.get("tag") ?? ""),
        tagEn: String(fd.get("tagEn") ?? ""),
      });
      if ("error" in r) {
        toast.error(String(r.error));
        return;
      }
      toast.success("Opgeslagen");
      setEditing(null);
      router.refresh();
    });
  }

  return (
    <div className="divide-y divide-border">
      {categories.map((c) => (
        <div key={c.key}>
          <div className="bg-muted px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{c.name} <span className="font-mono normal-case">({c.code})</span></div>
          <ul className="divide-y divide-border">
            {items.filter((i) => i.category === c.key).map((it) => (
              <li key={it.id} className="px-4 py-2.5">
                {editing === it.id ? (
                  <form onSubmit={(e) => { e.preventDefault(); save(it.id, e.currentTarget); }} className="grid gap-2 sm:grid-cols-2">
                    <input name="name" defaultValue={it.name} placeholder="Naam (NL)" className={INPUT} required />
                    <input name="nameEn" defaultValue={it.nameEn} placeholder="Name (EN)" className={INPUT} required />
                    <input name="description" defaultValue={it.description ?? ""} placeholder="Beschrijving (NL)" className={INPUT} />
                    <input name="descriptionEn" defaultValue={it.descriptionEn ?? ""} placeholder="Description (EN)" className={INPUT} />
                    <input name="tag" defaultValue={it.tag ?? ""} placeholder="Badge (bv. Favoriet)" className={INPUT} />
                    <input name="tagEn" defaultValue={it.tagEn ?? ""} placeholder="Badge (EN)" className={INPUT} />
                    <label className="flex items-center gap-2 text-sm">Prijs € <input name="price" type="number" step="0.05" min="0" defaultValue={it.price} className={`${INPUT} w-28`} required /></label>
                    <div className="flex items-center gap-4 text-sm">
                      <label className="flex items-center gap-1.5"><input type="checkbox" name="enabled" defaultChecked={it.enabled} className="accent-primary" /> Aan</label>
                      <label className="flex items-center gap-1.5"><input type="checkbox" name="soldOut" defaultChecked={it.soldOut} className="accent-primary" /> Uitverkocht</label>
                      <span className="ml-auto flex gap-2">
                        <button type="button" onClick={() => setEditing(null)} className="rounded-md px-3 py-1.5 text-sm text-muted-foreground">Annuleer</button>
                        <button type="submit" disabled={pending} className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"><Save className="size-4" /> Opslaan</button>
                      </span>
                    </div>
                  </form>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className="w-16 shrink-0 font-mono text-xs text-muted-foreground">{it.no || "-"}</span>
                    <div className="min-w-0 flex-1">
                      <span className="font-medium text-foreground">{it.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{it.nameEn}</span>
                      {it.flow && <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">{it.flow}</span>}
                      {it.description && <span className="block truncate text-xs text-muted-foreground">{it.description}</span>}
                    </div>
                    <span className="w-16 text-right text-sm tabular-nums">€ {it.price.toFixed(2).replace(".", ",")}</span>
                    {!it.enabled ? <StatusBadge tone="neutral">Uit</StatusBadge> : it.soldOut ? <StatusBadge tone="warning">Uitverkocht</StatusBadge> : <StatusBadge tone="success">Aan</StatusBadge>}
                    <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={it.enabled} disabled={pending} onChange={(e) => toggle(it.id, "enabled", e.target.checked)} className="accent-primary" /> aan</label>
                    <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={it.soldOut} disabled={pending} onChange={(e) => toggle(it.id, "soldOut", e.target.checked)} className="accent-primary" /> uitverkocht</label>
                    <button type="button" onClick={() => setEditing(it.id)} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted" aria-label="Bewerken"><Pencil className="size-4" /></button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export interface CodeRow {
  code: string;
  type: "PCT" | "EUR";
  value: number;
  enabled: boolean;
  expiresAt: string;
  maxUses: number | null;
  uses: number;
}

export function DiscountCodesAdmin({ codes }: { codes: CodeRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function save(form: HTMLFormElement) {
    const fd = new FormData(form);
    startTransition(async () => {
      const r = await saveDiscountCode({
        code: String(fd.get("code") ?? ""),
        type: fd.get("type") === "EUR" ? "EUR" : "PCT",
        value: Number(fd.get("value") ?? 0),
        enabled: fd.get("enabled") === "on",
        expiresAt: String(fd.get("expiresAt") ?? ""),
        maxUses: Number(fd.get("maxUses") ?? 0),
      });
      if ("error" in r) {
        toast.error(String(r.error));
        return;
      }
      toast.success(`Code ${r.code} opgeslagen`);
      setOpen(false);
      form.reset();
      router.refresh();
    });
  }

  return (
    <div>
      <table className="w-full text-sm">
        <thead className="text-xs uppercase tracking-wider text-muted-foreground">
          <tr><th className="py-2 text-left">Code</th><th className="py-2 text-left">Korting</th><th className="py-2 text-left">Geldig tot</th><th className="py-2 text-right">Gebruikt</th><th className="py-2 text-left">Status</th><th /></tr>
        </thead>
        <tbody className="divide-y divide-border">
          {codes.map((c) => (
            <tr key={c.code}>
              <td className="py-2 font-mono font-semibold">{c.code}</td>
              <td className="py-2">{c.type === "PCT" ? `${c.value}%` : `€ ${c.value.toFixed(2).replace(".", ",")}`}</td>
              <td className="py-2 text-muted-foreground">{c.expiresAt || "-"}</td>
              <td className="py-2 text-right tabular-nums">{c.uses}{c.maxUses ? ` / ${c.maxUses}` : ""}</td>
              <td className="py-2">{c.enabled ? <StatusBadge tone="success">Actief</StatusBadge> : <StatusBadge tone="neutral">Uit</StatusBadge>}</td>
              <td className="py-2 text-right">
                <button type="button" disabled={pending} onClick={() => confirm(`Code ${c.code} verwijderen?`) && startTransition(async () => { await deleteDiscountCode(c.code); router.refresh(); })} className="rounded-md p-1.5 text-muted-foreground hover:text-rose-600" aria-label="Verwijderen"><Trash2 className="size-4" /></button>
              </td>
            </tr>
          ))}
          {codes.length === 0 && <tr><td colSpan={6} className="py-4 text-center text-muted-foreground">Nog geen codes.</td></tr>}
        </tbody>
      </table>
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted"><Plus className="size-4" /> Code toevoegen of wijzigen</button>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); save(e.currentTarget); }} className="mt-3 grid gap-2 rounded-md border border-border p-3 sm:grid-cols-6">
          <input name="code" placeholder="CODE" className={`${INPUT} font-mono uppercase`} required />
          <select name="type" className={INPUT}><option value="PCT">Procent</option><option value="EUR">Vast bedrag</option></select>
          <input name="value" type="number" step="0.5" min="0.5" placeholder="Waarde" className={INPUT} required />
          <input name="expiresAt" type="date" className={INPUT} />
          <input name="maxUses" type="number" min="0" placeholder="Max. keer (0 = onbeperkt)" className={INPUT} />
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 text-sm"><input type="checkbox" name="enabled" defaultChecked className="accent-primary" /> Actief</label>
            <button type="submit" disabled={pending} className="ml-auto rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-60">Opslaan</button>
          </div>
        </form>
      )}
    </div>
  );
}
