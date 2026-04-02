import { z } from "zod";

export const registerSchema = z.object({
  // Step 1: Account
  email: z.string().email("Ongeldig e-mailadres"),
  displayName: z
    .string()
    .min(3, "Minimaal 3 tekens")
    .max(30, "Maximaal 30 tekens")
    .regex(/^[a-zA-Z0-9_-]+$/, "Alleen letters, cijfers, - en _"),
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

  // Step 3: Address (optional)
  street: z.string().max(100).optional().or(z.literal("")),
  houseNumber: z.string().max(20).optional().or(z.literal("")),
  postalCode: z.string().max(20).optional().or(z.literal("")),

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
    if (data.country === "NL" && (!data.cocNumber || data.cocNumber.trim().length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "KVK-nummer is verplicht voor Nederlandse bedrijven",
        path: ["cocNumber"],
      });
    }
    if (data.country !== "NL" && (!data.cocNumber || data.cocNumber.trim().length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Bedrijfsregistratie-ID is verplicht",
        path: ["cocNumber"],
      });
    }
  }
});

export const loginSchema = z.object({
  email: z.string().email("Ongeldig e-mailadres"),
  password: z.string().min(1, "Wachtwoord is verplicht"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
