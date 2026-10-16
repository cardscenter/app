/**
 * Demo-ervaringen voor /ervaringen en de homepage (design-pass Fase C).
 *   npx tsx scripts/seed-testimonials-demo.ts
 * Idempotent (herkent op "[demo]" in de omschrijving), dev-only: weigert op
 * een libsql://-URL. Verwijderen: alle rijen met authorRole die met "[demo]"
 * begint weghalen in /dashboard/admin/testimonials.
 */
import { prisma } from "../src/lib/prisma";

const ROWS: Array<{ quote: string; authorName: string; authorRole: string; source: string; color: string; featured: boolean }> = [
  { quote: "Eindelijk een plek in Zeeuws-Vlaanderen waar je **gewoon kunt spelen** zonder eerst een uur te rijden. Dinsdag is nu vaste prik.", authorName: "Sven", authorRole: "[demo] League-speler", source: "DISCORD", color: "pink", featured: true },
  { quote: "Mijn zoon van tien speelt mee in de junior-divisie en ik weet **precies hoe laat hij klaar is**. De inschrijving en het ticket regelen we in twee minuten.", authorName: "Marieke", authorRole: "[demo] Ouder van Finn", source: "GOOGLE", color: "white", featured: true },
  { quote: "Friet bestellen vanaf je tafel en **niet hoeven opruimen**. Dat alleen al.", authorName: "Daan", authorRole: "[demo] Verzamelaar sinds 1999", source: "IN_STORE", color: "yellow", featured: true },
  { quote: "De bulk-inkoop was eerlijk en snel. Dozen opgestuurd, **binnen een week geld op mijn rekening** en een duidelijk overzicht van wat ze hadden geteld.", authorName: "Lotte", authorRole: "[demo] Verkocht haar collectie", source: "EMAIL", color: "blue", featured: true },
  { quote: "De stempelkaart vult zich vanzelf als je incheckt. **Tien avonden, gratis booster.** Simpel en het werkt.", authorName: "Jesse", authorRole: "[demo] Speelt Pokémon en One Piece", source: "INSTAGRAM", color: "green", featured: true },
  { quote: "Pre-release gedaan met **veertien tafels vol**. Goede sfeer, strakke organisatie, en de prijsuitreiking was binnen vijf minuten geregeld.", authorName: "Noor", authorRole: "[demo] Toernooispeler", source: "GOOGLE", color: "white", featured: true },
  { quote: "Je ziet op de site **hoeveel plekken er nog zijn** en of een avond meetelt voor de league. Geen gedoe met appgroepen meer.", authorName: "Tim", authorRole: "[demo] League-speler", source: "DISCORD", color: "pink", featured: false },
  { quote: "Als ouder vind ik het fijn dat de winkel **duidelijke huisregels** heeft en dat ik als contactpersoon een mailtje krijg bij de inschrijving.", authorName: "Sanne", authorRole: "[demo] Ouder van Mila", source: "EMAIL", color: "yellow", featured: false },
  { quote: "De kaartendatabase met prijzen is handig om snel te checken of een pull **de moeite waard is**. Ik gebruik hem vaker dan ik wil toegeven.", authorName: "Ruben", authorRole: "[demo] Verzamelaar", source: "OTHER", color: "blue", featured: false },
];

async function main() {
  const url = process.env.DATABASE_URL ?? "file:dev.db";
  if (url.startsWith("libsql://")) throw new Error("Dev-only: weigert op een live Turso-database.");
  const existing = await prisma.shopTestimonial.count({ where: { authorRole: { startsWith: "[demo]" } } });
  if (existing > 0) {
    console.log(`demo-ervaringen bestaan al (${existing}); niets gedaan`);
    return;
  }
  for (const [i, r] of ROWS.entries()) await prisma.shopTestimonial.create({ data: { ...r, approved: true, sortOrder: (i + 1) * 10 } });
  console.log(`ervaringen aangemaakt: ${ROWS.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
