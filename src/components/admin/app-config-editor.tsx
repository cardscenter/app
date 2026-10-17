"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { upsertAppConfig, deleteAppConfig } from "@/actions/admin/app-config";
import { Save, Trash2, Edit2, X, Plus, AlertCircle, CheckCircle2, Settings2 } from "lucide-react";
import { EmptyState } from "@/components/dashboard/ui/empty-state";
import { cn } from "@/lib/utils";
import { PILL_BTN, PILL_BTN_SM, PILL_RED, INPUT, H3, TEXTAREA } from "@/components/ploy/tile-styles";

type Entry = { key: string; value: string; updatedAt: string };

export function AppConfigEditor({ entries }: { entries: Entry[] }) {
  const [creating, setCreating] = useState(false);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className={H3}>
          Records ({entries.length})
        </h2>
        {!creating && (
          <button
            onClick={() => setCreating(true)}
            className={PILL_RED}
          >
            <Plus className="h-4 w-4" /> Nieuwe key
          </button>
        )}
      </div>

      {creating && (
        <ConfigForm
          mode="create"
          onClose={() => setCreating(false)}
        />
      )}

      <div className="space-y-2">
        {entries.length === 0 && !creating && (
          <EmptyState icon={Settings2} title="Nog geen AppConfig-records." compact />
        )}
        {entries.map((e) => (
          <ConfigRow key={e.key} entry={e} />
        ))}
      </div>
    </div>
  );
}

function ConfigRow({ entry }: { entry: Entry }) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleDelete() {
    if (!confirm(`Verwijder key "${entry.key}"?`)) return;
    startTransition(async () => {
      const res = await deleteAppConfig(entry.key);
      if (res.error) alert(res.error);
      else router.refresh();
    });
  }

  let pretty = entry.value;
  try {
    pretty = JSON.stringify(JSON.parse(entry.value), null, 2);
  } catch {
    /* keep raw */
  }

  if (editing) {
    return <ConfigForm mode="edit" entry={entry} onClose={() => setEditing(false)} />;
  }

  return (
    <div className="dash-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <code className="rounded-full bg-muted px-2.5 py-0.5 text-sm font-semibold">{entry.key}</code>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Bijgewerkt: {new Date(entry.updatedAt).toLocaleString("nl-NL")}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setEditing(true)}
            className={PILL_BTN_SM}
          >
            <Edit2 className="h-3 w-3" /> Bewerk
          </button>
          <button
            onClick={handleDelete}
            disabled={pending}
            className="cc-pill inline-flex items-center gap-1.5 bg-[var(--pastel-pink)] px-3 py-1.5 text-xs font-semibold text-[var(--pastel-pink-ink)] transition-opacity hover:opacity-85 disabled:opacity-50"
          >
            <Trash2 className="h-3 w-3" /> Verwijder
          </button>
        </div>
      </div>
      <pre className="mt-3 overflow-x-auto rounded-[10px] bg-[var(--background)] p-3 text-xs">
        {pretty}
      </pre>
    </div>
  );
}

function ConfigForm({
  mode,
  entry,
  onClose,
}: {
  mode: "create" | "edit";
  entry?: Entry;
  onClose: () => void;
}) {
  const [key, setKey] = useState(entry?.key ?? "");
  const [value, setValue] = useState(() => {
    if (!entry) return '{}';
    try { return JSON.stringify(JSON.parse(entry.value), null, 2); }
    catch { return entry.value; }
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  // Live JSON validation
  let validationStatus: { ok: boolean; msg: string } = { ok: true, msg: "Geldige JSON" };
  try {
    JSON.parse(value);
  } catch (e) {
    validationStatus = { ok: false, msg: e instanceof Error ? e.message : "parse-fout" };
  }

  function format() {
    try {
      setValue(JSON.stringify(JSON.parse(value), null, 2));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "parse-fout");
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!key.trim()) {
      setError("Key is verplicht");
      return;
    }
    if (!validationStatus.ok) {
      setError(validationStatus.msg);
      return;
    }
    startTransition(async () => {
      const res = await upsertAppConfig(key, value);
      if (res.error) setError(res.error);
      else {
        router.refresh();
        onClose();
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3 dash-card p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold tracking-[-0.02em]">{mode === "create" ? "Nieuwe AppConfig key" : `Bewerken: ${entry?.key}`}</h3>
        <button type="button" onClick={onClose} className="rounded-full p-1.5 hover:bg-[var(--background)]">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-foreground">Key</label>
        <input
          type="text"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          disabled={mode === "edit"}
          className={`${INPUT} font-mono disabled:opacity-50`}
        />
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-foreground">Value (JSON)</label>
          <button
            type="button"
            onClick={format}
            className={PILL_BTN_SM}
          >
            Format
          </button>
        </div>
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={12}
          className={cn(TEXTAREA, "font-mono text-xs")}
          placeholder='{"foo": "bar"}'
        />
        <p className={`flex items-center gap-1 text-xs ${validationStatus.ok ? "text-[var(--pastel-green-ink)]" : "text-destructive"}`}>
          {validationStatus.ok ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
          {validationStatus.msg}
        </p>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className={PILL_BTN}
        >
          Annuleer
        </button>
        <button
          type="submit"
          disabled={pending || !validationStatus.ok}
          className={`${PILL_RED} disabled:opacity-50`}
        >
          <Save className="h-4 w-4" />
          {pending ? "Opslaan…" : "Opslaan"}
        </button>
      </div>
    </form>
  );
}
