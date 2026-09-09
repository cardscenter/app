import { z } from "zod";
import { USERNAME_MAX, USERNAME_MIN, USERNAME_REGEX } from "@/lib/username-policy";

/**
 * E-mailadres normaliseren (Fase 45): trim + lowercase. Registratie sloeg het
 * adres letterlijk op terwijl de reset-lookup lowercased; SQLite vergelijkt
 * binair, dus "Youri@X.com" kreeg nooit een reset-mail. Overal dezelfde vorm.
 */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export const registerSchema = z.object({
  // Step 1: Account
  email: z.string().trim().toLowerCase().email("Ongeldig e-mailadres"),
  displayName: z
    .string()
    .min(USERNAME_MIN, `Minimaal ${USERNAME_MIN} tekens`)
    .max(USERNAME_MAX, `Maximaal ${USERNAME_MAX} tekens`)
    .regex(USERNAME_REGEX, "Alleen letters, cijfers, - en _"),
  password: z.string().min(8, "Minimaal 8 tekens"),
  confirmPassword: z.string(),

  // Step 2: Personal info
  accountKind: z.enum(["INDIVIDUAL", "BUSINESS"]),
  firstName: z.string().min(1, "Voornaam is verplicht").max(50),
  lastName: z.string().min(1, "Achternaam is verplicht").max(50),
  city: z.string().min(1, "Woonplaats is verplicht").max(100),
  country: z.string().min(2, "Land is verplicht").max(2),
  // Business fields (optional, validated via superRefine)
  companyName: z.string().max(100).optional().or(z.literal("")),
  cocNumber: z.string().max(50).optional().or(z.literal("")),
  vatNumber: z.string().max(50).optional().or(z.literal("")),

  // Step 3: Address — verplicht sinds Fase 43 zodat elk account vanaf dag 1
  // hasValidShippingAddress-geldig is en gekoppeld aan de verzendmethoden van
  // het land. Postcode-format bewust vrij (EU-breed; land-specifieke validatie
  // is een follow-up).
  street: z.string().min(1, "Straatnaam is verplicht").max(100),
  houseNumber: z.string().min(1, "Huisnummer is verplicht").max(20),
  postalCode: z.string().min(1, "Postcode is verplicht").max(20),

  // Step 4: Avatar (optional)
  avatarUrl: z.string().optional().or(z.literal("")),

  // Step 5: Preferences
  accountFocus: z.enum(["BUYING", "SELLING", "BOTH"]),
  referralSource: z.string().max(50).optional().or(z.literal("")),
  termsAccepted: z.literal(true, { error: "Je moet de voorwaarden accepteren" }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Wachtwoorden komen niet overeen",
  path: ["confirmPassword"],
}).superRefine((data, ctx) => {
  if (data.accountKind === "BUSINESS") {
    if (!data.companyName || data.companyName.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Bedrijfsnaam is verplicht",
        path: ["companyName"],
      });
    }
    const coc = (data.cocNumber ?? "").trim();
    if (data.country === "NL") {
      if (!coc) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "KVK-nummer is verplicht voor Nederlandse bedrijven", path: ["cocNumber"] });
      } else if (!/^\d{8}$/.test(coc)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Een KvK-nummer bestaat uit 8 cijfers", path: ["cocNumber"] });
      }
    } else if (!coc) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Bedrijfsregistratie-ID is verplicht", path: ["cocNumber"] });
    } else if (!/^[0-9A-Za-z.-]{6,14}$/.test(coc)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Ongeldig registratienummer (6–14 tekens)", path: ["cocNumber"] });
    }
    const vat = (data.vatNumber ?? "").trim().toUpperCase();
    if (vat && !/^[A-Z]{2}[A-Z0-9]{2,12}$/.test(vat)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Ongeldig btw-id (bv. NL123456789B01)", path: ["vatNumber"] });
    }
  }
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Ongeldig e-mailadres"),
  password: z.string().min(1, "Wachtwoord is verplicht"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
