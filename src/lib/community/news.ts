import "server-only";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email/send-email";
import { getAppUrl, renderNotificationEmail } from "@/lib/email/layout";
import { createUnsubscribeToken, NEWSLETTER_CATEGORY } from "@/lib/email/unsubscribe";
import { slugify } from "./config";

/**
 * Nieuws (Fase 5): berichten van de winkel + nieuwsbrief naar opt-in-leden.
 */

export interface NewsListItem {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  coverImage: string | null;
  pinned: boolean;
  publishedAt: string | null;
}

export async function listPublishedNews(take = 50): Promise<NewsListItem[]> {
  const rows = await prisma.newsPost.findMany({
    where: { status: "PUBLISHED" },
    orderBy: [{ pinned: "desc" }, { publishedAt: "desc" }],
    take,
    select: { id: true, slug: true, title: true, excerpt: true, coverImage: true, pinned: true, publishedAt: true },
  });
  return rows.map((r) => ({ ...r, publishedAt: r.publishedAt?.toISOString() ?? null }));
}

export async function getPublishedNews(slug: string) {
  return prisma.newsPost.findFirst({ where: { slug, status: "PUBLISHED" }, include: { author: { select: { displayName: true } } } });
}

export async function listAllNews() {
  return prisma.newsPost.findMany({ orderBy: [{ status: "asc" }, { updatedAt: "desc" }], include: { author: { select: { displayName: true } } } });
}

export async function uniqueSlug(title: string, excludeId?: string): Promise<string> {
  const base = slugify(title) || "bericht";
  let slug = base;
  for (let i = 2; i < 100; i++) {
    const hit = await prisma.newsPost.findUnique({ where: { slug }, select: { id: true } });
    if (!hit || hit.id === excludeId) return slug;
    slug = `${base}-${i}`;
  }
  return `${base}-${Date.now()}`;
}

/**
 * Nieuwsbrief versturen voor een gepubliceerd bericht: alleen naar leden met
 * `newsletterOptIn`, geverifieerd e-mailadres en niet verwijderd. Eén keer per
 * bericht (claim-first op `newsletterSentAt`).
 */
export async function sendNewsletterForPost(postId: string): Promise<{ ok: true; recipients: number } | { error: string }> {
  const claimed = await prisma.newsPost.updateMany({ where: { id: postId, status: "PUBLISHED", newsletterSentAt: null }, data: { newsletterSentAt: new Date() } });
  if (claimed.count !== 1) return { error: "Bericht is niet gepubliceerd of de nieuwsbrief is al verstuurd" };
  const post = await prisma.newsPost.findUnique({ where: { id: postId } });
  if (!post) return { error: "Bericht niet gevonden" };
  const users = await prisma.user.findMany({
    where: { newsletterOptIn: true, emailVerifiedAt: { not: null }, deletedAt: null },
    select: { id: true, email: true, displayName: true },
  });
  const appUrl = getAppUrl();
  const intro = post.excerpt?.trim() || post.body.replace(/\r\n/g, "\n").split(/\n\s*\n/)[0]?.trim() || "";
  let sent = 0;
  for (const u of users) {
    const token = createUnsubscribeToken(u.id, NEWSLETTER_CATEGORY);
    const unsubscribeUrl = `${appUrl}/api/email/unsubscribe?token=${encodeURIComponent(token)}`;
    const { html, text } = renderNotificationEmail({
      recipientName: u.displayName,
      title: post.title,
      body: intro,
      ctaUrl: `/nieuws/${post.slug}`,
      ctaLabel: "Lees verder",
      unsubscribeUrl,
      categoryLabel: "Nieuws",
    });
    try {
      await sendEmail({
        to: u.email,
        subject: `Cards Center: ${post.title}`,
        html,
        text,
        headers: { "List-Unsubscribe": `<${unsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
      });
      sent++;
    } catch (e) {
      console.error("[news] nieuwsbrief naar", u.id, "mislukt", e);
    }
  }
  await prisma.newsPost.update({ where: { id: postId }, data: { newsletterRecipients: sent } });
  return { ok: true, recipients: sent };
}
