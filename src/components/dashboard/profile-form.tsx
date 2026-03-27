"use client";

import { useTranslations } from "next-intl";
import { updateProfile } from "@/actions/profile";
import { signOut } from "next-auth/react";
import { useActionState } from "react";
import type { User } from "@prisma/client";

export function ProfileForm({ user }: { user: User }) {
  const t = useTranslations("profile");
  const tc = useTranslations("common");

  const [state, formAction, pending] = useActionState(
    async (_prev: { success?: boolean; error?: string } | null | undefined, formData: FormData) => {
      const result = await updateProfile(formData);
      return result ?? null;
    },
    null
  );

  return (
    <form action={formAction} className="space-y-6">
      {state?.success && (
        <div className="rounded-lg bg-green-50 p-4 text-sm text-green-600 dark:bg-green-950 dark:text-green-400">
          {t("saved")}
        </div>
      )}
      {state?.error && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
          {state.error}
        </div>
      )}

      <div>
        <label htmlFor="displayName" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {t("displayName")}
        </label>
        <input
          id="displayName"
          name="displayName"
          type="text"
          defaultValue={user.displayName}
          required
          className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
        />
      </div>

      <div>
        <label htmlFor="bio" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {t("bio")}
        </label>
        <textarea
          id="bio"
          name="bio"
          rows={3}
          defaultValue={user.bio ?? ""}
          className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
        />
      </div>

      <div>
        <label htmlFor="defaultShippingCost" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {t("shippingCost")}
        </label>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-zinc-500">€</span>
          <input
            id="defaultShippingCost"
            name="defaultShippingCost"
            type="number"
            step="0.01"
            min="0"
            defaultValue={user.defaultShippingCost.toFixed(2)}
            className="block w-32 rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-50"
        >
          {pending ? "..." : tc("save")}
        </button>

        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/" })}
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/20"
        >
          {tc("logout")}
        </button>
      </div>
    </form>
  );
}
