/**
 * Allowlist-sanitizer voor rich-text uit de RichTextEditor (Fase 45).
 *
 * De editor produceert alleen b/strong/i/em/u/ul/ol/li/div/br (execCommand),
 * maar de HTML komt via een formulier binnen en wordt op een publieke pagina
 * met dangerouslySetInnerHTML gerenderd. We houden daarom een strikte
 * allowlist aan: onbekende tags worden gestript (tekst blijft), alle
 * attributen verdwijnen behalve een veilige http(s)-href op <a>, en
 * script/style/iframe/object/embed/svg/math verdwijnen mét inhoud.
 *
 * Toegepast bij opslaan én bij renderen van winkelpagina-blokken. Geen
 * externe dependency (DOM-vrij, regex-gebaseerd — geschikt voor de beperkte
 * output van onze eigen editor, niet als generieke HTML-sanitizer).
 */

const ALLOWED_TAGS = new Set(["p", "br", "b", "strong", "i", "em", "u", "ul", "ol", "li", "div", "a"]);
const DROP_WITH_CONTENT = ["script", "style", "iframe", "object", "embed", "svg", "math", "template", "noscript"];

export function sanitizeRichText(input: string): string {
  if (!input) return "";
  let html = input;

  // 1. Gevaarlijke elementen inclusief inhoud weg.
  for (const tag of DROP_WITH_CONTENT) {
    html = html.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, "gi"), "");
    html = html.replace(new RegExp(`<${tag}\\b[^>]*\\/?>`, "gi"), "");
  }
  // 2. Comments weg.
  html = html.replace(/<!--[\s\S]*?-->/g, "");

  // 3. Elke resterende tag door de allowlist halen.
  html = html.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g, (match, rawName: string, attrs: string) => {
    const name = rawName.toLowerCase();
    const closing = match.startsWith("</");
    if (!ALLOWED_TAGS.has(name)) return "";
    if (closing) return `</${name}>`;
    if (name === "br") return "<br>";
    if (name === "a") {
      const hrefMatch = /href\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrs);
      const href = (hrefMatch?.[2] ?? hrefMatch?.[3] ?? hrefMatch?.[4] ?? "").trim();
      if (/^https?:\/\/[^\s"'<>]+$/i.test(href)) {
        const safe = href.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
        return `<a href="${safe}" target="_blank" rel="noopener noreferrer nofollow">`;
      }
      return "<a>";
    }
    return `<${name}>`;
  });

  return html;
}

/** Zichtbare tekstlengte (zonder tags) — voor tellers en limieten. */
export function richTextLength(html: string): number {
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim().length;
}

/** Zelfde klassen als de advertentie-/event-beschrijving zodat opmaak overal gelijk oogt. */
export const richTextClassName =
  "prose prose-sm max-w-none text-foreground dark:prose-invert [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-primary [&_a]:underline";
