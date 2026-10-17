"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { StatusBadge } from "@/components/dashboard/ui/status-badge";
import { toggleGameOption } from "@/actions/admin/hub";
import type { GameDefinition } from "@/lib/games";
import { TABLE_CELL, TABLE_HEAD } from "@/components/ploy/tile-styles";
import { cn } from "@/lib/utils";

type Row = GameDefinition & { favoriteCount: number };

export function GameOptionsTable({ games }: { games: Row[] }) {
  const [rows, setRows] = useState(games);
  const [pending, startTransition] = useTransition();

  function toggle(key: string, enabled: boolean) {
    const previous = rows;
    setRows((r) => r.map((g) => (g.key === key ? { ...g, enabled } : g)));
    startTransition(async () => {
      const res = await toggleGameOption(key, enabled);
      if (res && "error" in res) {
        setRows(previous);
        toast.error(res.error);
        return;
      }
      toast.success(enabled ? "Spel aangezet" : "Spel uitgezet");
    });
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className={cn(TABLE_HEAD, "bg-[var(--background)]")}>
          <tr>
            <th className={TABLE_CELL}>Spel</th>
            <th className={TABLE_CELL}>Spelers-ID</th>
            <th className={TABLE_CELL}>Favoriet bij</th>
            <th className={TABLE_CELL}>Status</th>
            <th className={cn(TABLE_CELL, "text-right")}>Aan/uit</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((g) => (
            <tr key={g.key}>
              <td className="px-4 py-3">
                <p className="font-semibold text-foreground">{g.name}</p>
                <code className="text-xs text-muted-foreground">{g.key}</code>
              </td>
              <td className="px-4 py-3 text-muted-foreground">{g.playerIdLabel ?? "geen"}</td>
              <td className="px-4 py-3 tabular-nums">{g.favoriteCount}</td>
              <td className="px-4 py-3">
                <StatusBadge tone={g.enabled ? "success" : "neutral"}>{g.enabled ? "aan" : "uit"}</StatusBadge>
              </td>
              <td className="px-4 py-3 text-right">
                <Switch checked={g.enabled} onCheckedChange={(v) => toggle(g.key, v)} disabled={pending} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
