/**
 * Centrale e-mail-dispatch voor notificaties (Fase 16).
 *
 * Wordt fire-and-forget aangeroepen vanuit createNotification — één haakpunt
 * voor alle ~134 notificatie-callsites. Beslist per notificatie of er een
 * mail uitgaat op basis van: categorie-mapping, gebruikersvoorkeuren,
 * e-mailverificatie en throttles (EmailLog).
 *
 * Mag NOOIT throwen richting de caller — een mislukte mail breekt geen
 * verkoop/bied/dispute-actie.
 */

import "server-only";

import { prisma } from "@/lib/prisma";
import { sendEmail, getAppUrl } from "@/lib/email/send-email";
import { renderNotificationEmail } from "@/lib/email/layout";
import { createUnsubscribeToken } from "@/lib/email/unsubscribe";
import {
  notificationTypeToCategory,
  parseEmailPreferences,
  THROTTLED_TYPES,
  EMAIL_THROTTLE_MINUTES,
  EMAIL_PREF_CATEGORIES,
  type EmailPrefCategory,
} from "@/lib/email/preferences-config";

interface NotificationEmailArgs {
  userId: string;
  type: string;
  title: string;
  body: string;
  link?: string;
}

/** Pill-label rechtsboven in de mail-header, per categorie. */
const CATEGORY_LABELS: Record<string, string> = {
  account: "Account",
  orders: "Bestelling",
  bids: "Veiling",
  messages: "Bericht",
  disputes: "Geschil",
  events: "Evenement",
};

export async function maybeSendNotificationEmail(args: NotificationEmailArgs): Promise<void> {
  try {
    const category = notificationTypeToCategory(args.type);
    if (!category) return;

    const user = await prisma.user.findUnique({
      where: { id: args.userId },
      select: {
        email: true,
        emailVerifiedAt: true,
        emailPreferences: true,
        displayName: true,
      },
    });
    if (!user?.email) return;

    // Alleen geverifieerde adressen — bounces op tikfout-adressen slopen
    // de domein-reputatie. Verificatie/reset-mails blijven hierbuiten.
    if (!user.emailVerifiedAt) return;

    if (category !== "account") {
      const prefs = parseEmailPreferences(user.emailPreferences);
      if (!prefs[category as EmailPrefCategory]) return;
    }

    // Throttle: max 1 mail per dedupeKey per uur (OUTBID-biedoorlogen,
    // NEW_MESSAGE-flows die kort na elkaar meerdere notificaties maken).
    const dedupeKey = THROTTLED_TYPES.has(args.type)
      ? `${args.type}:${args.userId}:${args.link ?? "-"}`
      : null;
    if (dedupeKey) {
      const since = new Date(Date.now() - EMAIL_THROTTLE_MINUTES * 60 * 1000);
      const recent = await prisma.emailLog.findFirst({
        where: { dedupeKey, sentAt: { gte: since } },
        select: { id: true },
      });
      if (recent) return;
    }

    const unsubscribeUrl =
      category !== "account"
        ? `${getAppUrl()}/api/email/unsubscribe?token=${encodeURIComponent(
            createUnsubscribeToken(args.userId, category as EmailPrefCategory),
          )}`
        : undefined;

    const { html, text } = renderNotificationEmail({
      recipientName: user.displayName,
      title: args.title,
      body: args.body,
      ctaUrl: args.link,
      categoryLabel: CATEGORY_LABELS[category],
      unsubscribeUrl,
    });

    await sendEmail({
      to: user.email,
      subject: args.title,
      html,
      text,
      ...(unsubscribeUrl
        ? {
            headers: {
              "List-Unsubscribe": `<${unsubscribeUrl}>`,
              "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            },
          }
        : {}),
    });

    await prisma.emailLog.create({
      data: {
        userId: args.userId,
        category,
        type: args.type,
        dedupeKey,
        subject: args.title,
      },
    });
  } catch (err) {
    console.error("[email] notificatie-mail mislukt:", err);
  }
}

/**
 * Herbruikbare check + verzending voor de chat-ongelezen-cron: zelfde
 * prefs/verificatie/log-flow, maar met een eigen episode-dedupe die de
 * caller zelf bepaalt (dedupeKey + guard zit in de cron-query).
 */
export async function sendChatUnreadEmail(args: {
  userId: string;
  senderName: string;
  preview: string;
  conversationId: string;
}): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: args.userId },
      select: { email: true, emailVerifiedAt: true, emailPreferences: true, displayName: true },
    });
    if (!user?.email || !user.emailVerifiedAt) return false;
    if (!parseEmailPreferences(user.emailPreferences).messages) return false;

    const unsubscribeUrl = `${getAppUrl()}/api/email/unsubscribe?token=${encodeURIComponent(
      createUnsubscribeToken(args.userId, "messages"),
    )}`;

    const title = `Nieuw bericht van ${args.senderName}`;
    const { html, text } = renderNotificationEmail({
      recipientName: user.displayName,
      title,
      body: `"${args.preview}"\n\nBeantwoord het bericht op Cards Center.`,
      ctaUrl: `/berichten/${args.conversationId}`,
      ctaLabel: "Bekijk bericht",
      categoryLabel: CATEGORY_LABELS.messages,
      unsubscribeUrl,
    });

    await sendEmail({
      to: user.email,
      subject: title,
      html,
      text,
      headers: {
        "List-Unsubscribe": `<${unsubscribeUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    });

    await prisma.emailLog.create({
      data: {
        userId: args.userId,
        category: "messages",
        type: "CHAT_UNREAD",
        dedupeKey: `chat:${args.conversationId}:${args.userId}`,
        subject: title,
      },
    });
    return true;
  } catch (err) {
    console.error("[email] chat-mail mislukt:", err);
    return false;
  }
}

/** Valide categorie-check voor de unsubscribe-route (hergebruik van config). */
export function isKnownPrefCategory(value: string): value is EmailPrefCategory {
  return EMAIL_PREF_CATEGORIES.some((c) => c.key === value);
}
