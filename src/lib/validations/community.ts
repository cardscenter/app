import { z } from "zod";
import { BADGE_CRITERIA } from "@/lib/community/config";

/** Zod-schema's voor league, badges en nieuws (Fase 5). Client-importable. */

export const leagueSeasonSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    game: z.string().trim().max(40).optional().or(z.literal("")),
    description: z.string().trim().max(2000).optional().or(z.literal("")),
    startsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Startdatum ontbreekt"),
    endsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Einddatum ontbreekt"),
    pointsWin: z.coerce.number().int().min(0).max(100),
    pointsDraw: z.coerce.number().int().min(0).max(100),
    pointsLoss: z.coerce.number().int().min(0).max(100),
    pointsParticipation: z.coerce.number().int().min(0).max(100),
  })
  .refine((d) => d.endsAt >= d.startsAt, { message: "Einddatum ligt voor de startdatum", path: ["endsAt"] });

export const leagueBadgeSchema = z.object({
  key: z.string().trim().min(2).max(40).regex(/^[a-z0-9-]+$/, "Sleutel: alleen kleine letters, cijfers en streepjes"),
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(300).optional().or(z.literal("")),
  color: z.string().trim().min(2).max(20),
  criterion: z.enum(BADGE_CRITERIA),
  threshold: z.coerce.number().int().min(1).max(100000),
  sortOrder: z.coerce.number().int().min(0).max(10000),
  enabled: z.coerce.boolean(),
});

export const leagueResultSchema = z.object({
  seasonId: z.string().min(1),
  eventId: z.string().min(1).nullable(),
  userId: z.string().min(1),
  wins: z.coerce.number().int().min(0).max(99),
  losses: z.coerce.number().int().min(0).max(99),
  draws: z.coerce.number().int().min(0).max(99),
  bonusPoints: z.coerce.number().int().min(-99).max(99).default(0),
  note: z.string().trim().max(200).optional().or(z.literal("")),
});

export const newsPostSchema = z.object({
  title: z.string().trim().min(3).max(120),
  excerpt: z.string().trim().max(300).optional().or(z.literal("")),
  body: z.string().trim().min(10).max(20000),
  coverImage: z.string().trim().max(500).optional().or(z.literal("")),
  pinned: z.coerce.boolean(),
  status: z.enum(["DRAFT", "PUBLISHED"]),
});

export const internalNoteSchema = z.object({ note: z.string().trim().max(2000) });
