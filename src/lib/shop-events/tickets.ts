import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import QRCode from "qrcode";

/**
 * Ticket-QR (Community Hub, Fase 3). De QR bevat "CC|<ticketCode>|<sig>" met
 * sig = HMAC-SHA256(ticketCode, qrSecret) (eerste 16 hex-tekens). De scanner
 * zoekt op ticketCode en controleert de handtekening tegen de opgeslagen
 * qrSecret, zodat een zelfgemaakte QR met een geraden code niet werkt.
 * Handmatig intypen van de code (zonder sig) blijft toegestaan voor staff.
 */

export function newQrSecret(): string {
  return randomBytes(24).toString("base64url");
}

export function signTicket(ticketCode: string, qrSecret: string): string {
  return createHmac("sha256", qrSecret).update(ticketCode).digest("hex").slice(0, 16);
}

export function verifyTicketSignature(ticketCode: string, qrSecret: string, sig: string): boolean {
  const expected = Buffer.from(signTicket(ticketCode, qrSecret));
  const given = Buffer.from(sig.trim().toLowerCase());
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export function buildQrPayload(ticketCode: string, qrSecret: string): string {
  return `CC|${ticketCode}|${signTicket(ticketCode, qrSecret)}`;
}

/** "CC|CODE|SIG" → { code, sig } of null. */
export function parseQrPayload(raw: string): { code: string; sig: string } | null {
  const parts = raw.trim().split("|");
  if (parts.length !== 3 || parts[0] !== "CC") return null;
  return { code: parts[1].toUpperCase(), sig: parts[2] };
}

export async function ticketQrDataUrl(ticketCode: string, qrSecret: string): Promise<string> {
  return QRCode.toDataURL(buildQrPayload(ticketCode, qrSecret), {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 320,
    color: { dark: "#0f172a", light: "#ffffff" },
  });
}
