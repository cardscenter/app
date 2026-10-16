import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { bodyFont, displayFont, monoFont } from "@/app/fonts";
import { routing } from "@/i18n/routing";
import { SiteNav } from "@/components/layout/site-nav";
import { Footer } from "@/components/layout/footer";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { RealtimeProvider } from "@/components/providers/realtime-provider";
import { FeatureFlagsProvider } from "@/components/providers/feature-flags-provider";
import { AchievementUnlockListener } from "@/components/customization/achievement-unlock-listener";
import { ResponsiveToaster } from "@/components/ui/responsive-toaster";
import { auth } from "@/lib/auth";
import { getFeatureSnapshot } from "@/lib/feature-flags";
import "../globals.css";

export const metadata: Metadata = {
  title: "Cards Center",
  description:
    "Koop, verkoop en veil Pokémon trading cards",
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as "nl" | "en")) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();
  const session = await auth();
  // Feature-flags per bezoeker (Community Hub, Fase 1): admins zien alles.
  const features = getFeatureSnapshot(session?.user?.accountType);

  return (
    <html
      lang={locale}
      className={`${bodyFont.variable} ${monoFont.variable} ${displayFont.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeProvider>
          <NextIntlClientProvider messages={messages}>
            <FeatureFlagsProvider value={features}>
              <RealtimeProvider isAuthenticated={!!session?.user?.id}>
                <SiteNav initialViewer={session?.user ? { name: session.user.name ?? "", image: session.user.image ?? null } : null} />
                <main className="flex-1 pt-[var(--site-nav-offset)]">{children}</main>
                <Footer />
                <ResponsiveToaster />
                {/* Prestatie-toasts tonen Ember; die horen bij het saldo-model. */}
                {features.FEATURE_WALLET && features.FEATURE_XP && (
                  <AchievementUnlockListener isAuthenticated={!!session?.user?.id} />
                )}
              </RealtimeProvider>
            </FeatureFlagsProvider>
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
