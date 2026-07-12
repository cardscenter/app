import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { NotificationList } from "@/components/ui/notification-list";
import { EmailPreferencesSection } from "@/components/dashboard/email-preferences";
import { parseEmailPreferences } from "@/lib/email/preferences-config";

export default async function MeldingenPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect(`/${locale}/login`);

  const t = await getTranslations("notifications");

  const [notifications, user] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { emailPreferences: true, emailVerifiedAt: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>

      <EmailPreferencesSection
        initialPrefs={parseEmailPreferences(user?.emailPreferences)}
        emailVerified={Boolean(user?.emailVerifiedAt)}
      />

      {notifications.length === 0 ? (
        <div className="glass-subtle rounded-2xl p-8 text-center text-muted-foreground">
          {t("empty")}
        </div>
      ) : (
        <NotificationList
          notifications={notifications.map((n) => ({
            id: n.id,
            type: n.type,
            title: n.title,
            body: n.body,
            link: n.link,
            read: n.read,
            createdAt: n.createdAt.toISOString(),
          }))}
        />
      )}
    </div>
  );
}
