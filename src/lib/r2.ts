// Cloudflare R2 object-storage client (S3-compatible).
//
// Productie bewaart geüploade bestanden in R2 i.p.v. de lokale containerschijf
// (die Railway bij elke redeploy wist). R2 is S3-compatibel, dus we gebruiken
// de AWS S3-SDK met het R2-endpoint.
//
// Lokaal (geen R2-env-vars) valt `upload.ts` + de serve-route terug op de
// schijf, zodat dev geen R2-account nodig heeft. `isR2Configured()` is de
// schakelaar tussen beide paden.

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucket = process.env.R2_BUCKET;

export function isR2Configured(): boolean {
  return Boolean(accountId && accessKeyId && secretAccessKey && bucket);
}

const globalForR2 = globalThis as unknown as { r2Client?: S3Client };

function getClient(): S3Client {
  if (!isR2Configured()) {
    throw new Error("R2 is niet geconfigureerd (ontbrekende R2_* env-vars).");
  }
  if (!globalForR2.r2Client) {
    globalForR2.r2Client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: accessKeyId as string,
        secretAccessKey: secretAccessKey as string,
      },
    });
  }
  return globalForR2.r2Client;
}

export async function r2PutObject(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  await getClient().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

export async function r2GetObject(
  key: string,
): Promise<{ body: Buffer; contentType?: string } | null> {
  try {
    const res = await getClient().send(
      new GetObjectCommand({ Bucket: bucket, Key: key }),
    );
    if (!res.Body) return null;
    // SDK v3 Node-stream body heeft transformToByteArray()
    const bytes = await res.Body.transformToByteArray();
    return { body: Buffer.from(bytes), contentType: res.ContentType };
  } catch {
    // NoSuchKey / netwerkfout → behandel als "niet gevonden"
    return null;
  }
}

export async function r2DeleteObject(key: string): Promise<void> {
  // No-op-safe: een ontbrekend object geeft bij R2 geen error, en netwerk-
  // fouten loggen we maar laten we niet de cron breken.
  try {
    await getClient().send(
      new DeleteObjectCommand({ Bucket: bucket, Key: key }),
    );
  } catch (err) {
    console.warn(`[r2] kon object niet verwijderen: ${key}`, err);
  }
}
