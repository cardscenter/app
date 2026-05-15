"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { suspendUser, liftSuspension } from "@/actions/admin-suspension";
import { resetIbanCooldown, forceUsernameReset } from "@/actions/admin/users";
import { Ban, ShieldOff, RotateCcw, UserCog, CreditCard, X } from "lucide-react";

type Props = {
  userId: string;
  userName: string;
  isSuspended: boolean;
  hasIban: boolean;
  hasUsernameCooldown: boolean;
};

export function UserActionBar({ userId, userName, isSuspended, hasIban, hasUsernameCooldown }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [suspendType, setSuspendType] = useState<"TEMPORARY" | "PERMANENT">("TEMPORARY");
  const [days, setDays] = useState("7");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSuspend(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (reason.trim().length < 5) {
      setError("Reden minimaal 5 tekens.");
      return;
    }
    const fd = new FormData();
    fd.set("type", suspendType);
    fd.set("reason", reason.trim());
    if (suspendType === "TEMPORARY") fd.set("days", days);
    startTransition(async () => {
      const res = await suspendUser(userId, fd);
      if ("error" in res) {
        setError(res.error ?? null);
      } else {
        setSuspendOpen(false);
        setReason("");
        router.refresh();
      }
    });
  }

  function handleLift() {
    if (!confirm(`Weet je zeker dat je de opschorting van ${userName} wilt opheffen?`)) return;
    startTransition(async () => {
      const res = await liftSuspension(userId);
      if ("error" in res) alert(res.error);
      else router.refresh();
    });
  }

  function handleResetIban() {
    if (!confirm(`Reset IBAN-cooldown voor ${userName}?`)) return;
    startTransition(async () => {
      const res = await resetIbanCooldown(userId);
      if ("error" in res) alert(res.error);
      else router.refresh();
    });
  }

  function handleResetUsername() {
    if (!confirm(`Reset username-cooldown voor ${userName}?`)) return;
    startTransition(async () => {
      const res = await forceUsernameReset(userId);
      if ("error" in res) alert(res.error);
      else router.refresh();
    });
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {isSuspended ? (
          <button
            onClick={handleLift}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            <ShieldOff className="h-4 w-4" /> Hef opschorting op
          </button>
        ) : (
          <button
            onClick={() => setSuspendOpen(true)}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-md bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
          >
            <Ban className="h-4 w-4" /> Opschorten
          </button>
        )}

        <Link
          href={`/dashboard/admin/bank-transfers?q=${encodeURIComponent(userName)}`}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium hover:bg-muted"
        >
          <CreditCard className="h-4 w-4" /> Bevestig storting
        </Link>

        {hasIban && (
          <button
            onClick={handleResetIban}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            <RotateCcw className="h-4 w-4" /> Reset IBAN-cooldown
          </button>
        )}

        {hasUsernameCooldown && (
          <button
            onClick={handleResetUsername}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            <UserCog className="h-4 w-4" /> Reset username-cooldown
          </button>
        )}
      </div>

      {suspendOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={handleSuspend}
            className="w-full max-w-md space-y-3 rounded-xl border border-border bg-card p-5 shadow-lg"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Opschorten: {userName}</h3>
              <button
                type="button"
                onClick={() => setSuspendOpen(false)}
                className="rounded-md p-1 hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Type</label>
              <div className="flex gap-2">
                {(["TEMPORARY", "PERMANENT"] as const).map((t) => (
                  <label key={t} className="flex flex-1 cursor-pointer items-center gap-2 rounded-md border p-2 text-sm">
                    <input
                      type="radio"
                      name="type"
                      value={t}
                      checked={suspendType === t}
                      onChange={() => setSuspendType(t)}
                    />
                    {t === "TEMPORARY" ? "Tijdelijk" : "Permanent"}
                  </label>
                ))}
              </div>
            </div>
            {suspendType === "TEMPORARY" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Aantal dagen (1-365)</label>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={days}
                  onChange={(e) => setDays(e.target.value)}
                  className="w-full rounded-md border border-border bg-card px-3 py-1.5 text-sm"
                />
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium">Reden (zichtbaar voor user)</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="Min. 5 tekens"
                className="w-full rounded-md border border-border bg-card px-3 py-1.5 text-sm"
              />
            </div>
            {error && <p className="text-xs text-rose-600">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSuspendOpen(false)}
                className="rounded-md border border-border bg-card px-3 py-1.5 text-sm hover:bg-muted"
              >
                Annuleer
              </button>
              <button
                type="submit"
                disabled={pending}
                className="rounded-md bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {pending ? "Bezig…" : "Opschorten"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
