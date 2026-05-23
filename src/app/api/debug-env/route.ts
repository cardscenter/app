import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// TIJDELIJKE diagnose-route — verwijderen zodra de deploy werkt.
// Lekt geen geheimen: toont alleen schema/lengte/booleans, geen waarden.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const dbUrl = process.env.DATABASE_URL;
  const token = process.env.TURSO_AUTH_TOKEN;
  const trustHost = process.env.AUTH_TRUST_HOST;

  const scheme = !dbUrl
    ? "MISSING (valt terug op file:dev.db → lege DB!)"
    : dbUrl.startsWith("libsql://")
      ? "libsql (Turso) ✓"
      : dbUrl.startsWith('"')
        ? "BEGINT MET QUOTE — fout opmaak!"
        : dbUrl.startsWith("file:")
          ? "file (lokaal — fout!)"
          : `onbekend: ${dbUrl.slice(0, 12)}`;

  let dbCheck: string;
  try {
    const n = await prisma.user.count();
    dbCheck = `OK — verbonden met DB, User-tabel telt ${n} rijen`;
  } catch (e) {
    dbCheck = "FOUT: " + (e instanceof Error ? e.message : String(e));
  }

  return NextResponse.json({
    DATABASE_URL_scheme: scheme,
    DATABASE_URL_length: dbUrl?.length ?? 0,
    TURSO_AUTH_TOKEN_present: !!token,
    TURSO_AUTH_TOKEN_length: (token ?? "").length, // verwacht ~279
    AUTH_TRUST_HOST_exact: JSON.stringify(trustHost ?? null), // verwacht "true"
    db_check: dbCheck,
  });
}
