"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { inviteBusinessMember, removeBusinessMember, updateBusinessMemberTitle } from "@/actions/business-team";
import { MAX_BUSINESS_MEMBERS, MEMBER_TITLE_MAX } from "@/lib/business-team-config";
import { UserAvatar } from "@/components/ui/user-avatar";
import { StatusBadge } from "@/components/dashboard/ui/status-badge";
import { PROFILE_INPUT_CLASS } from "@/components/dashboard/profile-form";

export type TeamManagerRow = {
  id: string;
  userId: string;
  displayName: string;
  fullName: string;
  avatarUrl: string | null;
  title: string | null;
  status: string;
};

/**
 * Teambeheer voor de eigenaar van een bedrijfspagina (profiel-redesign sept
 * 2026), in de control-kolom van een FieldRow op /dashboard/profiel:
 * ledenlijst (naam, @handle, functie, status) met verwijderen + functie
 * bewerken, en een uitnodig-regel op gebruikersnaam.
 */
export function BusinessTeamManager({ members }: { members: TeamManagerRow[] }) {
  const t = useTranslations("profile");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [username, setUsername] = useState("");
  const [title, setTitle] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  function invite(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await inviteBusinessMember(username, title);
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(t("teamInviteSent"));
      setUsername("");
      setTitle("");
      router.refresh();
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const result = await removeBusinessMember(id);
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  }

  function saveTitle(id: string) {
    startTransition(async () => {
      const result = await updateBusinessMemberTitle(id, editTitle);
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      setEditingId(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {members.length > 0 && (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {members.map((m) => (
            <li key={m.id} className="flex items-center gap-3 px-3 py-2.5">
              <UserAvatar src={m.avatarUrl} name={m.fullName} size="md" />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
                  <Link href={`/spelers/${m.userId}`} className="font-semibold text-foreground hover:underline">
                    {m.fullName}
                  </Link>
                  <span className="text-xs text-muted-foreground">@{m.displayName}</span>
                  {m.status === "PENDING" && <StatusBadge tone="warning">{t("teamPending")}</StatusBadge>}
                </p>
                {editingId === m.id ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      saveTitle(m.id);
                    }}
                    className="mt-1 flex items-center gap-2"
                  >
                    <input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      maxLength={MEMBER_TITLE_MAX}
                      placeholder={t("teamTitlePlaceholder")}
                      className={`${PROFILE_INPUT_CLASS} max-w-xs py-1.5 text-xs`}
                      autoFocus
                    />
                    <button type="submit" disabled={pending} className="text-xs font-medium text-primary hover:text-primary-hover">
                      {t("teamSaveTitle")}
                    </button>
                    <button type="button" onClick={() => setEditingId(null)} className="text-xs text-muted-foreground hover:text-foreground">
                      {t("cancel")}
                    </button>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(m.id);
                      setEditTitle(m.title ?? "");
                    }}
                    className="mt-0.5 text-xs text-muted-foreground hover:text-foreground"
                  >
                    {m.title ?? t("teamNoTitle")} · <span className="text-primary">{t("teamEditTitle")}</span>
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => remove(m.id)}
                disabled={pending}
                aria-label={t("teamRemove")}
                title={t("teamRemove")}
                className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-red-600"
              >
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {members.length < MAX_BUSINESS_MEMBERS && (
        <form onSubmit={invite} className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">@</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={t("teamInviteUsername")}
              className={`${PROFILE_INPUT_CLASS} pl-8`}
              autoComplete="off"
              spellCheck={false}
              required
            />
          </div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={MEMBER_TITLE_MAX}
            placeholder={t("teamTitlePlaceholder")}
            className={`${PROFILE_INPUT_CLASS} sm:max-w-[12rem]`}
          />
          <button
            type="submit"
            disabled={pending || !username.trim()}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-50"
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            {t("teamInvite")}
          </button>
        </form>
      )}
      <p className="text-xs text-muted-foreground">{t("teamInviteHint", { max: MAX_BUSINESS_MEMBERS })}</p>
    </div>
  );
}
