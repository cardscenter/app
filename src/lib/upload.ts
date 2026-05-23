import { writeFile, mkdir, unlink } from "fs/promises";
import { join } from "path";
import { prisma } from "@/lib/prisma";
import { moderateImage, type ModeratableMimeType } from "@/lib/moderation";
import { isR2Configured, r2PutObject, r2DeleteObject } from "@/lib/r2";

const UPLOAD_DIR = join(process.cwd(), "public", "uploads");
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES: ReadonlyArray<ModeratableMimeType> = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

export type UploadContext =
  | "listing"
  | "auction"
  | "avatar"
  | "chat"
  | "claimsale"
  | "verification"
  // (Fase 40) "dispute" = bewijsfoto's uit DisputeV2-flow door buyer/seller.
  // "shipping" = optionele verzend-proof-foto's bij markAsShipped (pakket-
  // label, doos-foto). Beide door moderation om misbruik te voorkomen
  // (NSFW/scam-uitingen in plaats van legit bewijs).
  | "dispute"
  | "shipping";

const MODERATED_CONTEXTS: ReadonlySet<UploadContext> = new Set<UploadContext>([
  "listing",
  "auction",
  "avatar",
  "chat",
  "dispute",
  "shipping",
]);

export const MODERATION_BLOCKED_PREFIX = "MODERATION_BLOCKED:";

export async function saveUploadedFile(
  file: File,
  options?: { context?: UploadContext; userId?: string },
): Promise<string> {
  if (!ALLOWED_TYPES.includes(file.type as ModeratableMimeType)) {
    throw new Error(`Ongeldig bestandstype: ${file.type}. Toegestaan: JPG, PNG, WebP`);
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error("Bestand is te groot. Maximaal 5MB.");
  }

  const mimeType = file.type as ModeratableMimeType;
  const buffer = Buffer.from(await file.arrayBuffer());

  const context = options?.context;
  if (context && MODERATED_CONTEXTS.has(context)) {
    const verdict = await moderateImage(buffer, mimeType);

    const verdictKey = verdict.safe
      ? verdict.skipped === "missing_key"
        ? "skipped_no_key"
        : verdict.skipped === "api_unavailable"
          ? "skipped_unavailable"
          : "safe"
      : "blocked";

    await prisma.imageModerationLog
      .create({
        data: {
          userId: options?.userId ?? null,
          context,
          verdict: verdictKey,
          reason: verdict.safe ? null : verdict.reason,
          mimeType,
          sizeBytes: buffer.length,
        },
      })
      .catch((err) => {
        console.warn("[upload] kon ImageModerationLog niet schrijven:", err);
      });

    if (!verdict.safe) {
      throw new Error(`${MODERATION_BLOCKED_PREFIX}${verdict.reason}`);
    }
  }

  const ext = file.name.split(".").pop() ?? "jpg";
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  // Productie → R2; lokale dev (geen R2-env) → schijf. Het URL-contract
  // `/api/uploads/{filename}` blijft in beide gevallen identiek, zodat de DB,
  // de UI en de opruim-cron niet hoeven te weten waar de bytes staan.
  if (isR2Configured()) {
    await r2PutObject(filename, buffer, mimeType);
  } else {
    await mkdir(UPLOAD_DIR, { recursive: true });
    await writeFile(join(UPLOAD_DIR, filename), buffer);
  }

  return `/api/uploads/${filename}`;
}

export function parseImageUrls(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Matcht alleen lokaal-geüploade bestanden (`/api/uploads/{ts}-{rand}.{ext}`).
// Externe/seed-URLs (tcgdex, /images/test-images/, ...) geven null → nooit
// per ongeluk verwijderd. Hoofdletter-ext toegestaan (i-flag).
const UPLOAD_URL_RE = /^\/api\/uploads\/(\d+-[a-z0-9]+\.(?:jpg|jpeg|png|webp))$/i;

export function extractUploadFilename(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = UPLOAD_URL_RE.exec(url.trim());
  return match ? match[1] : null;
}

/**
 * Verwijdert een geüpload bestand (R2 in productie, schijf lokaal). Niet-
 * throwend en idempotent: externe/onbekende URLs en al-verwijderde bestanden
 * zijn een no-op. Returnt true als het een lokaal bestand betrof (voor
 * cron-statistieken). Gebruikt door de `cleanup-sold-images` cron.
 */
export async function deleteUploadedFile(url: string | null | undefined): Promise<boolean> {
  const filename = extractUploadFilename(url);
  if (!filename) return false;
  try {
    if (isR2Configured()) {
      await r2DeleteObject(filename);
    } else {
      await unlink(join(UPLOAD_DIR, filename));
    }
    return true;
  } catch {
    // Bestand bestond al niet meer — prima, idempotent.
    return false;
  }
}
