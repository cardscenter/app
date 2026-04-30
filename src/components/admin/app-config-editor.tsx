"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { upsertAppConfig, deleteAppConfig } from "@/actions/admin/app-config";
import { Save, Trash2, Edit2, X, Plus, AlertCircle, CheckCircle2 } from "lucide-react";

type Entry = { key: string; value: string; updatedAt: string };

export function AppConfigEditor({ entries }: { entries: Entry[] }) {
  const [creating, setCreating] = useState(false);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground/70">
          Records ({entries.length})
        </h2>
        {!creating && (
          <button
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-hover"
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
          <p className="rounded-xl border border-dashed bg-slate-50 p-8 text-center text-sm text-muted-foreground dark:bg-slate-900/50">
            Nog geen AppConfig-records.
          </p>
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
    <div className="rounded-xl border bg-white p-4 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <code className="rounded bg-slate-100 px-2 py-0.5 text-sm font-semibold dark:bg-slate-800">{entry.key}</code>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Bijgewerkt: {new Date(entry.updatedAt).toLocaleString("nl-NL")}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1 rounded-md border bg-white px-2 py-1 text-xs hover:bg-slate-50 dark:bg-slate-900"
          >
            <Edit2 className="h-3 w-3" /> Bewerk
          </button>
          <button
            onClick={handleDelete}
            disabled={pending}
            className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-xs text-rose-700 hover:bg-rose-100 disabled:opacity-50 dark:border-rose-900/50 dark:bg-rose-950/30"
          >
            <Trash2 className="h-3 w-3" /> Verwijder
          </button>
        </div>
      </div>
      <pre className="mt-3 overflow-x-auto rounded-md bg-slate-50 p-3 text-xs dark:bg-slate-800/40">
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
    <form onSubmit={submit} className="space-y-3 rounded-xl border-2 border-primary/30 bg-white p-4 dark:bg-slate-900">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{mode === "create" ? "Nieuwe AppConfig key" : `Bewerken: ${entry?.key}`}</h3>
        <button type="button" onClick={onClose} className="rounded-md p-1 hover:bg-slate-100 dark:hover:bg-slate-800">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-1">
        <label className="text-[11px] uppercase tracking-wider text-muted-foreground/70">Key</label>
        <input
          type="text"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          disabled={mode === "edit"}
          className="w-full rounded-md border bg-white px-3 py-1.5 font-mono text-sm dark:bg-slate-800 disabled:opacity-50"
        />
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label className="text-[11px] uppercase tracking-wider text-muted-foreground/70">Value (JSON)</label>
          <button
            type="button"
            onClick={format}
            className="rounded-md border bg-white px-2 py-0.5 text-xs hover:bg-slate-50 dark:bg-slate-900"
          >
            Format
          </button>
        </div>
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={12}
          className="w-full rounded-md border bg-white px-3 py-2 font-mono text-xs dark:bg-slate-800"
          placeholder='{"foo": "bar"}'
        />
        <p className={`flex items-center gap-1 text-xs ${validationStatus.ok ? "text-emerald-600" : "text-rose-600"}`}>
          {validationStatus.ok ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
          {validationStatus.msg}
        </p>
      </div>

      {error && <p className="text-xs text-rose-600">{error}</p>}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border bg-white px-3 py-1.5 text-sm hover:bg-slate-50 dark:bg-slate-900"
        >
          Annuleer
        </button>
        <button
          type="submit"
          disabled={pending || !validationStatus.ok}
          className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {pending ? "Opslaan…" : "Opslaan"}
        </button>
      </div>
    </form>
  );
}
