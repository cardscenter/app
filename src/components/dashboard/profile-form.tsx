"use client";

import { useTranslations } from "next-intl";
import { updateProfile } from "@/actions/profile";
import { signOut } from "next-auth/react";
import { useActionState } from "react";
import { useRef, useState } from "react";
import { Camera, X } from "lucide-react";
import type { User } from "@prisma/client";

export function ProfileForm({ user }: { user: User }) {
  const t = useTranslations("profile");
  const tc = useTranslations("common");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user.avatarUrl);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);

  const [state, formAction, pending] = useActionState(
    async (_prev: { success?: boolean; error?: string } | null | undefined, formData: FormData) => {
      if (avatarFile) {
        formData.set("avatarFile", avatarFile);
      }
      if (removeAvatar) {
        formData.set("removeAvatar", "true");
      }
      const result = await updateProfile(formData);
      if (result?.success) {
        setAvatarFile(null);
        setRemoveAvatar(false);
      }
      return result ?? null;
    },
    null
  );

  function handleAvatarSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setRemoveAvatar(false);
    setAvatarPreview(URL.createObjectURL(file));
  }

  function handleRemoveAvatar() {
    setAvatarFile(null);
    setRemoveAvatar(true);
    setAvatarPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const initial = user.displayName?.charAt(0).toUpperCase() ?? "?";

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

      {/* Avatar upload */}
      <div className="flex items-center gap-4">
        <div className="relative">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="group relative h-20 w-20 overflow-hidden rounded-full border-2 border-border transition-colors hover:border-primary"
          >
            {avatarPreview ? (
              <img
                src={avatarPreview}
                alt={user.displayName}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-muted text-2xl font-bold text-muted-foreground">
                {initial}
              </div>
            )}
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
              <Camera className="h-5 w-5 text-white" />
            </div>
          </button>
          {avatarPreview && (
            <button
              type="button"
              onClick={handleRemoveAvatar}
              className="absolute -right-1 -top-1 rounded-full bg-destructive p-1 text-destructive-foreground shadow-sm transition-colors hover:bg-destructive/80"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
        <div className="text-sm text-muted-foreground">
          <p className="font-medium text-foreground">{t("profilePhoto")}</p>
          <p>{t("photoHint")}</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={handleAvatarSelect}
          className="hidden"
        />
      </div>

      <div>
        <label htmlFor="displayName" className="block text-sm font-medium text-foreground">
          {t("displayName")}
        </label>
        <input
          id="displayName"
          name="displayName"
          type="text"
          defaultValue={user.displayName}
          required
          className="mt-1 block w-full rounded-lg glass-input px-3 py-2 text-foreground focus:border-border focus:outline-none focus:ring-1 focus:ring-border"
        />
      </div>

      <div>
        <label htmlFor="bio" className="block text-sm font-medium text-foreground">
          {t("bio")}
        </label>
        <textarea
          id="bio"
          name="bio"
          rows={3}
          defaultValue={user.bio ?? ""}
          className="mt-1 block w-full rounded-lg glass-input px-3 py-2 text-foreground focus:border-border focus:outline-none focus:ring-1 focus:ring-border"
        />
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
