import Papa from "papaparse";
import { z } from "zod";

// CSV-formaat voor bulk-upload (Fase 31, PRO+ feature). Bewust gestript:
// geen images, geen card-items-JSON, geen tcgdex-resolution. Sellers
// gebruiken bulk-upload voor de tekst-velden + voegen images per listing
// achteraf toe via de standaard edit-flow.

export const BULK_CSV_TEMPLATE = `title,listingType,condition,deliveryMethod,price,pricingType,description,shippingMethodIds
"Pikachu Holo PSA 9","SINGLE_CARD","NEAR_MINT","SHIP",24.99,"FIXED","Pikachu uit Base Set, professioneel gegradeerd",
"Eevee Evolutions Bundle","COLLECTION","LIGHTLY_PLAYED","BOTH",89.50,"FIXED","Complete Eevee evolution set, 8 kaarten",
"Booster Pack Sword & Shield","SEALED_PRODUCT","","SHIP",4.95,"FIXED","Verzegeld booster pack",
`;

export const BulkRowSchema = z.object({
  title: z.string().min(3, "Titel min 3 tekens").max(120),
  listingType: z.enum(["SINGLE_CARD", "MULTI_CARD", "COLLECTION", "SEALED_PRODUCT", "OTHER"]),
  condition: z
    .enum(["MINT", "NEAR_MINT", "LIGHTLY_PLAYED", "MODERATELY_PLAYED", "HEAVILY_PLAYED", "DAMAGED", ""])
    .optional()
    .transform((v) => (v === "" ? null : v)),
  deliveryMethod: z.enum(["SHIP", "PICKUP", "BOTH"]),
  price: z.coerce.number().min(0.01, "Prijs vereist (>0)").max(100000),
  pricingType: z.enum(["FIXED", "NEGOTIABLE"]).default("FIXED"),
  description: z.string().max(2000).optional().transform((v) => v ?? ""),
  shippingMethodIds: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(";").map((id) => id.trim()).filter(Boolean) : [])),
});

export type BulkRow = z.infer<typeof BulkRowSchema>;

export interface BulkParseResult {
  rows: { row: number; data: BulkRow }[];
  errors: { row: number; field?: string; message: string }[];
}

export function parseCsvText(text: string): BulkParseResult {
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  const rows: BulkParseResult["rows"] = [];
  const errors: BulkParseResult["errors"] = [];

  if (parsed.errors.length > 0) {
    for (const err of parsed.errors) {
      errors.push({
        row: (err.row ?? 0) + 2, // +1 voor header, +1 voor 1-based
        message: err.message,
      });
    }
  }

  parsed.data.forEach((rawRow, idx) => {
    const rowNumber = idx + 2; // +1 voor header, +1 voor 1-based
    const result = BulkRowSchema.safeParse(rawRow);
    if (!result.success) {
      for (const issue of result.error.issues) {
        errors.push({
          row: rowNumber,
          field: issue.path.join("."),
          message: issue.message,
        });
      }
      return;
    }
    rows.push({ row: rowNumber, data: result.data });
  });

  return { rows, errors };
}
