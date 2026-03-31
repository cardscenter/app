import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { ProfileForm } from "@/components/dashboard/profile-form";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const t = await getTranslations("dashboard");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      usernameHistory: {
        orderBy: { changedAt: "desc" },
        take: 5,
      },
    },
  });

  if (!user) return null;

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">
        {t("profile")}
      </h1>
      <div className="mt-8 max-w-lg">
        <ProfileForm user={user} />
      </div>
    </div>
  );
}
