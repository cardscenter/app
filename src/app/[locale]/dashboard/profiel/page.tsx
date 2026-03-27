import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { ProfileForm } from "@/components/dashboard/profile-form";

export default async function ProfilePage() {
  const session = await auth();
  const t = await getTranslations("profile");

  const user = await prisma.user.findUnique({
    where: { id: session!.user!.id },
  });

  if (!user) return null;

  return (
    <div>
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
        {t("displayName")}
      </h1>
      <div className="mt-8 max-w-lg">
        <ProfileForm user={user} />
      </div>
    </div>
  );
}
