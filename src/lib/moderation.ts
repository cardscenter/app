import "server-only";
import Anthropic from "@anthropic-ai/sdk";

export type ModerationVerdict =
  | { safe: true; skipped?: never }
  | { safe: false; reason: string }
  | { safe: true; skipped: "api_unavailable" | "missing_key" };

export type ModeratableMimeType = "image/jpeg" | "image/png" | "image/webp";

const MODEL = "claude-haiku-4-5-20251001";
const TIMEOUT_MS = 8_000;

const SYSTEM_PROMPT = `Je bent een content-moderator voor een Pokémon-trading-card marketplace. Beoordeel of deze foto onaanvaardbare content bevat. De volgende categorieën zijn niet toegestaan — gebruik per categorie EXACT de aangegeven Nederlandse reden:

(1) Seksueel of naakt materiaal (ook getekend/anime/render).
    → reason: "Bevat seksueel of naakt materiaal."

(2) Grafisch geweld, bloed, of verwondingen.
    → reason: "Bevat grafisch geweld of bloed."

(3) Haatsymbolen of extremistische iconografie (hakenkruis, SS, ISIS-vlag, en vergelijkbaar).
    → reason: "Bevat haat- of extremistische symbolen."

(4) Politieke of extremistische tekst, vlaggen of leuzen die niet bij een TCG-marketplace passen.
    → reason: "Bevat politieke of extremistische content."

(5) Illegale producten: drugs, wapens, drugsattributen, illegaal vuurwerk.
    → reason: "Bevat illegale producten."

(6) Obscene of beledigende gebaren: middelvinger, 'fuck you'-gebaar, kruisgebaar tussen vingers, of vergelijkbaar. Wees streng — zelfs een klein gebaar in beeld is voldoende om te blokkeren.
    → reason: "Bevat een obsceen of beledigend gebaar."

(7) Grove tekst, scheldwoorden of beledigingen zichtbaar in de foto (op kleding, papier, achtergrond, etc.).
    → reason: "Bevat grove of beledigende tekst."

(8) QR-codes, URL's of duidelijke verwijzingen naar externe verkoop-kanalen of websites. Doel: voorkomen dat verkopers het platform omzeilen.
    → reason: "Bevat een QR-code of externe link."

(9) Spam, reclame-banners of commerciële content die niet over het te koop aangeboden item gaat. BELANGRIJK: officiële TCG-branding (Pokémon-logo, Pikachu, kaart-rugzijdes, set-symbolen, booster-pack-art, The Pokémon Company-logo, Wizards of the Coast, Magic the Gathering, Yu-Gi-Oh!, Konami, of vergelijkbare game-/uitgever-merken) is NOOIT spam of reclame — die hoort logisch bij het te koop aangeboden TCG-product en moet je doorlaten.
    → reason: "Bevat spam of reclame."

Alle andere content is OK — ook foto's van mensen, dieren, voorwerpen, of dingen die niet direct met kaarten te maken hebben. Een gewone foto van een persoon zonder iets onaanvaardbaars is prima. Officiële TCG-branding (Pokémon, Magic, Yu-Gi-Oh!, etc.) hoort vanzelfsprekend bij het product en is altijd toegestaan.

Roep \`report_verdict\` aan met je oordeel. Als unsafe, gebruik in \`reason\` de exacte zin uit de matchende categorie hierboven (geen variaties, geen uitleg toevoegen).`;

const VERDICT_TOOL = {
  name: "report_verdict",
  description: "Rapporteer of de foto fatsoenlijk is.",
  input_schema: {
    type: "object" as const,
    properties: {
      safe: {
        type: "boolean",
        description: "true als de foto geen ongepaste content bevat, anders false.",
      },
      reason: {
        type: "string",
        description: "Korte uitleg waarom de foto onaanvaardbaar is. Alleen invullen als safe=false.",
      },
    },
    required: ["safe"],
    additionalProperties: false,
  },
};

let cachedClient: Anthropic | null = null;
let missingKeyWarned = false;

function getClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) {
    if (!missingKeyWarned) {
      console.warn(
        "[moderation] ANTHROPIC_API_KEY niet gezet — uploads worden niet gecheckt (fail-open)",
      );
      missingKeyWarned = true;
    }
    return null;
  }
  if (!cachedClient) {
    cachedClient = new Anthropic();
  }
  return cachedClient;
}

export async function moderateImage(
  buffer: Buffer,
  mimeType: ModeratableMimeType,
): Promise<ModerationVerdict> {
  const client = getClient();
  if (!client) return { safe: true, skipped: "missing_key" };

  const base64 = buffer.toString("base64");

  try {
    const response = await client.messages.create(
      {
        model: MODEL,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        tools: [VERDICT_TOOL],
        tool_choice: { type: "tool", name: "report_verdict" },
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: mimeType, data: base64 },
              },
              {
                type: "text",
                text: "Beoordeel deze foto en roep report_verdict aan.",
              },
            ],
          },
        ],
      },
      { signal: AbortSignal.timeout(TIMEOUT_MS) },
    );

    const toolBlock = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
    );

    if (!toolBlock || toolBlock.name !== "report_verdict") {
      console.warn("[moderation] geen tool-use block in response — fail-open");
      return { safe: true, skipped: "api_unavailable" };
    }

    const input = toolBlock.input as { safe?: unknown; reason?: unknown };
    if (typeof input.safe !== "boolean") {
      console.warn("[moderation] tool-call zonder geldige safe-boolean — fail-open");
      return { safe: true, skipped: "api_unavailable" };
    }

    if (input.safe) return { safe: true };

    const reason =
      typeof input.reason === "string" && input.reason.trim().length > 0
        ? input.reason.trim().slice(0, 200)
        : "Ongepaste content gedetecteerd.";
    return { safe: false, reason };
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      console.warn(`[moderation] Anthropic API-fout ${err.status} — fail-open`);
    } else if (err instanceof DOMException && err.name === "TimeoutError") {
      console.warn(`[moderation] timeout na ${TIMEOUT_MS}ms — fail-open`);
    } else {
      console.warn("[moderation] onverwachte fout, fail-open:", err);
    }
    return { safe: true, skipped: "api_unavailable" };
  }
}
