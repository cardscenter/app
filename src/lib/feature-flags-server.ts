/**
 * Server-side helpers rond de feature-flags (Community Hub, Fase 1).
 * Mag `auth`/`redirect`/`NextResponse` importeren; de pure kern staat in
 * `feature-flags.ts` (ook bruikbaar in proxy, client en tests).
 *
 * Drie smaken, voor drie plekken:
 * - `requireFeature`        → server actions, geeft `{ ok } | { error }` terug
 *                             (zelfde shape als `requireNotSuspended`).
 * - `requireFeaturePage`    → page/layout, redirect naar de homepage.
 * - `assertFeatureForRoute` → route handlers, 404 (bestaan niet adverteren).
 *
 * Flag uit = uit voor iedereen, ook admins (besluit 2026-10-16); een flag
 * met `adminBypass: true` laat admins wel door. Alles loopt via
 * `isFeatureVisibleFor` zodat de regel op één plek staat.
 */
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  FEATURE_DISABLED_ERROR,
  isFeatureEnabled,
  isFeatureVisibleFor,
  type FeatureFlag,
} from "./feature-flags";

async function resolveAccountType(accountType?: string | null): Promise<string | null> {
  if (accountType !== undefined) return accountType;
  const session = await auth();
  return session?.user?.accountType ?? null;
}

/** Voor server actions. Geef `session.user.accountType` mee als je die al hebt. */
export async function requireFeature(
  flag: FeatureFlag,
  accountType?: string | null,
): Promise<{ ok: true } | { error: string }> {
  if (isFeatureEnabled(flag)) return { ok: true };
  const type = await resolveAccountType(accountType);
  if (isFeatureVisibleFor(flag, type)) return { ok: true };
  return { error: FEATURE_DISABLED_ERROR };
}

/** Voor pages/layouts: redirect naar de homepage van de locale als de functie uit staat. */
export async function requireFeaturePage(flag: FeatureFlag, locale: string): Promise<void> {
  if (isFeatureEnabled(flag)) return;
  const type = await resolveAccountType();
  if (isFeatureVisibleFor(flag, type)) return;
  // Handmatige locale-prefix via next/navigation — de next-intl-redirect gaf
  // in Next 16 + next-intl 4 "This page couldn't load" (zie CLAUDE.md).
  redirect(`/${locale}`);
}

/** Voor route handlers: `null` = door, anders een 404-response om terug te geven. */
export async function assertFeatureForRoute(
  flag: FeatureFlag,
  accountType?: string | null,
): Promise<NextResponse | null> {
  if (isFeatureEnabled(flag)) return null;
  const type = await resolveAccountType(accountType);
  if (isFeatureVisibleFor(flag, type)) return null;
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

/**
 * Factory voor een twee-regel `layout.tsx` die een hele pagina-boom achter
 * een flag zet:  `export default createFeatureLayout("FEATURE_AUCTIONS");`
 */
export function createFeatureLayout(flag: FeatureFlag) {
  return async function FeatureGateLayout({
    children,
    params,
  }: {
    children: ReactNode;
    params: Promise<{ locale: string }>;
  }) {
    const { locale } = await params;
    await requireFeaturePage(flag, locale);
    return children;
  };
}
