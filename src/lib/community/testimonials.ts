import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Ervaringen van spelers (design-pass Fase C): admin-beheerde quotes voor
 * de ervaringen-muur op /ervaringen en de rij op de homepage.
 */

export const TESTIMONIAL_SOURCES = ["GOOGLE", "INSTAGRAM", "DISCORD", "IN_STORE", "EMAIL", "OTHER"] as const;
export type TestimonialSource = (typeof TESTIMONIAL_SOURCES)[number];
export const TESTIMONIAL_COLORS = ["white", "pink", "yellow", "blue", "green"] as const;
export type TestimonialColor = (typeof TESTIMONIAL_COLORS)[number];

export interface TestimonialView {
  id: string;
  quote: string;
  authorName: string;
  authorRole: string | null;
  source: TestimonialSource;
  sourceUrl: string | null;
  avatarUrl: string | null;
  color: TestimonialColor;
  featured: boolean;
}

function toView(r: { id: string; quote: string; authorName: string; authorRole: string | null; source: string; sourceUrl: string | null; avatarUrl: string | null; color: string; featured: boolean }): TestimonialView {
  return {
    id: r.id,
    quote: r.quote,
    authorName: r.authorName,
    authorRole: r.authorRole,
    source: (TESTIMONIAL_SOURCES as readonly string[]).includes(r.source) ? (r.source as TestimonialSource) : "OTHER",
    sourceUrl: r.sourceUrl,
    avatarUrl: r.avatarUrl,
    color: (TESTIMONIAL_COLORS as readonly string[]).includes(r.color) ? (r.color as TestimonialColor) : "white",
    featured: r.featured,
  };
}

/** Goedgekeurde ervaringen, in beheervolgorde (nieuwste eerst bij gelijke volgorde). */
export async function listApprovedTestimonials(opts: { featuredOnly?: boolean; take?: number } = {}): Promise<TestimonialView[]> {
  const rows = await prisma.shopTestimonial.findMany({
    where: { approved: true, ...(opts.featuredOnly ? { featured: true } : {}) },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    take: opts.take,
  });
  return rows.map(toView);
}

/** Alle ervaringen voor het admin-overzicht. */
export async function listAllTestimonials() {
  return prisma.shopTestimonial.findMany({ orderBy: [{ approved: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }] });
}

export async function countApprovedTestimonials(): Promise<number> {
  return prisma.shopTestimonial.count({ where: { approved: true } });
}
