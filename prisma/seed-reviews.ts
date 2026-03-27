import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

import path from "path";
const dbPath = path.resolve(__dirname, "..", "dev.db");
const adapter = new PrismaLibSql({ url: `file:${dbPath}` });
const prisma = new PrismaClient({ adapter });

const reviewComments = [
  // 5 stars
  { rating: 5, comment: "Supersnelle verzending en kaart was in perfecte staat! Top verkoper!" },
  { rating: 5, comment: "Heel goed ingepakt, kaart kwam precies zoals beschreven aan. Aanrader!" },
  { rating: 5, comment: "Fantastische ervaring, kaart was zelfs mooier dan op de foto's. Dankjewel!" },
  { rating: 5, comment: "Snelle communicatie en verzending. Kaart was perfect. 10/10!" },
  { rating: 5, comment: "Mijn nieuwe favoriete verkoper op het platform. Alles klopte!" },
  { rating: 5, comment: null }, // some without comment
  { rating: 5, comment: "Goed verpakt met sleeve + toploader. Zeer tevreden!" },
  // 4 stars
  { rating: 4, comment: "Goede verkoper, kaart was in orde. Verzending duurde een dagje langer dan verwacht." },
  { rating: 4, comment: "Kaart was goed, verpakking kon iets beter maar verder prima!" },
  { rating: 4, comment: "Nette transactie, kaart zoals beschreven." },
  { rating: 4, comment: null },
  { rating: 4, comment: "Fijne verkoper, snelle reactie op berichten." },
  // 3 stars
  { rating: 3, comment: "Kaart was oké maar conditie was iets minder dan beschreven. Verder prima afhandeling." },
  { rating: 3, comment: "Verzending duurde lang maar kaart was wel in orde." },
  // 2 stars
  { rating: 2, comment: "Kaart was beschreven als Near Mint maar had duidelijk whitening op de hoeken." },
  // 1 star
  { rating: 1, comment: "Kaart nooit ontvangen, geen reactie op berichten. Teleurstellend." },
];

const sellerResponses = [
  "Bedankt voor de fijne review! Tot de volgende keer!",
  "Dankjewel! Fijn dat je tevreden bent!",
  "Bedankt! Hopelijk tot snel!",
  null,
  null,
  "Sorry voor het ongemak, we proberen het de volgende keer beter te doen!",
  null,
  null,
];

async function main() {
  console.log("⭐ Generating test reviews...\n");

  // Get all bot users
  const botUsers = await prisma.user.findMany({
    where: {
      email: { endsWith: "@test.nl" },
    },
  });

  if (botUsers.length === 0) {
    console.log("❌ No bot users found. Run seed-testdata.ts first!");
    return;
  }

  console.log(`Found ${botUsers.length} bot users\n`);

  // Delete existing reviews
  await prisma.review.deleteMany({});
  console.log("🗑️  Cleared existing reviews\n");

  let reviewCount = 0;

  // Generate reviews between bot users
  for (const seller of botUsers) {
    // Each seller gets 2-6 reviews from random other users
    const numReviews = 2 + Math.floor(Math.random() * 5);
    const reviewers = botUsers
      .filter((u) => u.id !== seller.id)
      .sort(() => Math.random() - 0.5)
      .slice(0, numReviews);

    for (const reviewer of reviewers) {
      const reviewData = reviewComments[Math.floor(Math.random() * reviewComments.length)];
      const shouldHaveResponse = Math.random() > 0.6;
      const response = shouldHaveResponse
        ? sellerResponses[Math.floor(Math.random() * sellerResponses.length)]
        : null;

      // Random date in the last 90 days
      const daysAgo = Math.floor(Math.random() * 90);
      const createdAt = new Date();
      createdAt.setDate(createdAt.getDate() - daysAgo);

      await prisma.review.create({
        data: {
          rating: reviewData.rating,
          comment: reviewData.comment,
          reviewerId: reviewer.id,
          sellerId: seller.id,
          sellerResponse: response,
          createdAt,
        },
      });

      reviewCount++;
    }

    console.log(`  ✓ ${seller.displayName}: ${numReviews} reviews`);
  }

  console.log(`\n✅ Generated ${reviewCount} reviews!`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
