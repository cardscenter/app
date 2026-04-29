import { z } from "zod";
import { isValidIbanFormat } from "@/lib/validations/iban";

const collectionItemSchema = z.object({
  cardId: z.string().min(1),
  quantity: z.number().int().min(1).max(100),
});

const bulkItemSchema = z.object({
  category: z.string().min(1),
  quantity: z.number().int().min(0),
});

export const submitCollectionBuybackSchema = z
  .object({
    items: z.string(), // JSON array of collectionItemSchema
    payoutMethod: z.enum(["BANK", "STORE_CREDIT"]),
    iban: z.string().optional(),
    accountHolder: z.string().optional(),
    confirmNearMint: z.coerce.boolean(),
    confirmNotOffCenter: z.coerce.boolean(),
  })
  .superRefine((data, ctx) => {
    // Validate items JSON
    try {
      const items = JSON.parse(data.items);
      if (!Array.isArray(items) || items.length === 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Voeg minimaal 1 kaart toe", path: ["items"] });
        return;
      }
      for (const item of items) {
        const result = collectionItemSchema.safeParse(item);
        if (!result.success) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Ongeldige kaartgegevens", path: ["items"] });
          return;
        }
      }
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Ongeldige kaartgegevens", path: ["items"] });
    }

    // Bank payout requires IBAN + account holder
    if (data.payoutMethod === "BANK") {
      if (!data.iban || !isValidIbanFormat(data.iban)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Ongeldig IBAN-formaat", path: ["iban"] });
      }
      if (!data.accountHolder || data.accountHolder.trim().length < 2) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Naam rekeninghouder is verplicht", path: ["accountHolder"] });
      }
    }

    if (!data.confirmNearMint) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Je moet bevestigen dat alle kaarten Near Mint zijn", path: ["confirmNearMint"] });
    }
    if (!data.confirmNotOffCenter) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Je moet bevestigen dat de kaarten niet off-center zijn", path: ["confirmNotOffCenter"] });
    }
  });

export const submitBulkBuybackSchema = z
  .object({
    bulkItems: z.string(), // JSON array of bulkItemSchema
    payoutMethod: z.enum(["BANK", "STORE_CREDIT"]),
    iban: z.string().optional(),
    accountHolder: z.string().optional(),
    confirmNearMint: z.coerce.boolean(),
    confirmSorted: z.coerce.boolean(),
  })
  .superRefine((data, ctx) => {
    // Validate bulk items JSON
    try {
      const items = JSON.parse(data.bulkItems);
      if (!Array.isArray(items) || items.length === 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Voeg minimaal 1 categorie toe", path: ["bulkItems"] });
        return;
      }
      const hasQuantity = items.some((item: { quantity?: number }) => item.quantity && item.quantity > 0);
      if (!hasQuantity) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Voeg minimaal 1 kaart toe", path: ["bulkItems"] });
        return;
      }
      for (const item of items) {
        const result = bulkItemSchema.safeParse(item);
        if (!result.success) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Ongeldige categoriegegevens", path: ["bulkItems"] });
          return;
        }
      }
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Ongeldige categoriegegevens", path: ["bulkItems"] });
    }

    // Bank payout requires IBAN + account holder
    if (data.payoutMethod === "BANK") {
      if (!data.iban || !isValidIbanFormat(data.iban)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Ongeldig IBAN-formaat", path: ["iban"] });
      }
      if (!data.accountHolder || data.accountHolder.trim().length < 2) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Naam rekeninghouder is verplicht", path: ["accountHolder"] });
      }
    }

    if (!data.confirmNearMint) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Je moet bevestigen dat alle kaarten Near Mint zijn", path: ["confirmNearMint"] });
    }
    if (!data.confirmSorted) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Je moet bevestigen dat de kaarten gesorteerd zijn", path: ["confirmSorted"] });
    }
  });
