"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Mail, SendHorizonal } from "lucide-react";

export function HeroEmailForm() {
  const t = useTranslations("home");
  const router = useRouter();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    if (email) {
      router.push(`/register?email=${encodeURIComponent(email)}`);
    } else {
      router.push("/register");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto my-10 max-w-sm lg:my-12 lg:ml-0 lg:mr-auto">
      <div className="bg-background has-[input:focus]:ring-muted relative grid grid-cols-[1fr_auto] items-center rounded-[1rem] border pr-1 shadow shadow-zinc-950/5 has-[input:focus]:ring-2">
        <Mail className="pointer-events-none absolute inset-y-0 left-5 my-auto size-5 text-muted-foreground" />
        <input
          name="email"
          placeholder={t("emailPlaceholder")}
          className="h-14 w-full bg-transparent pl-12 focus:outline-none text-sm"
          type="email"
        />
        <div className="md:pr-1.5 lg:pr-0">
          <Button type="submit" aria-label="submit">
            <span className="hidden md:block">{t("getStarted")}</span>
            <SendHorizonal className="relative mx-auto size-5 md:hidden" strokeWidth={2} />
          </Button>
        </div>
      </div>
    </form>
  );
}
