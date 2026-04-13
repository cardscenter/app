import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const adapter = new PrismaLibSql({ url: "file:dev.db" });
const prisma = new PrismaClient({ adapter });

// Mirror of ACHIEVEMENTS in src/lib/achievements.ts — keep in sync manually.
type TierSeed = {
  tier: number;
  threshold: number;
  rewardEmber?: number;
  rewardXP?: number;
  rewardCosmeticKey?: string;
};

type AchievementSeed = {
  key: string;
  name: string;
  description: string;
  category: string;
  sortOrder: number;
  tiers: TierSeed[];
};

const ACHIEVEMENTS: AchievementSeed[] = [
  {
    key: "days-online",
    name: "Days on Cards Center",
    description: "Totaal aantal dagen dat je account bestaat",
    category: "ARCHIVE",
    sortOrder: 10,
    tiers: [
      { tier: 1, threshold: 7,   rewardEmber: 25 },
      { tier: 2, threshold: 30,  rewardEmber: 75 },
      { tier: 3, threshold: 90,  rewardEmber: 200 },
      { tier: 4, threshold: 180, rewardEmber: 500,  rewardXP: 250 },
      { tier: 5, threshold: 365, rewardEmber: 1000, rewardXP: 500 },
    ],
  },
  {
    key: "purchases-completed",
    name: "Purchases Completed",
    description: "Aantal afgeronde aankopen",
    category: "VAULT",
    sortOrder: 20,
    tiers: [
      { tier: 1, threshold: 1,   rewardEmber: 25 },
      { tier: 2, threshold: 10,  rewardEmber: 100 },
      { tier: 3, threshold: 25,  rewardEmber: 250 },
      { tier: 4, threshold: 50,  rewardEmber: 500 },
      { tier: 5, threshold: 100, rewardEmber: 1000, rewardXP: 500 },
    ],
  },
  {
    key: "total-spent",
    name: "Total Spent",
    description: "Totaalbedrag aan voltooide aankopen (€)",
    category: "VAULT",
    sortOrder: 21,
    tiers: [
      { tier: 1, threshold: 100,   rewardEmber: 50 },
      { tier: 2, threshold: 500,   rewardEmber: 200 },
      { tier: 3, threshold: 1000,  rewardEmber: 500 },
      { tier: 4, threshold: 5000,  rewardEmber: 1500, rewardXP: 500 },
      { tier: 5, threshold: 10000, rewardEmber: 3000, rewardXP: 1000 },
    ],
  },
  {
    key: "sales-completed",
    name: "Sales Completed",
    description: "Aantal afgeronde verkopen",
    category: "TRADER",
    sortOrder: 30,
    tiers: [
      { tier: 1, threshold: 1,   rewardEmber: 25 },
      { tier: 2, threshold: 10,  rewardEmber: 100 },
      { tier: 3, threshold: 25,  rewardEmber: 300 },
      { tier: 4, threshold: 50,  rewardEmber: 600, rewardXP: 250 },
      { tier: 5, threshold: 100, rewardEmber: 1200, rewardXP: 500 },
    ],
  },
  {
    key: "total-earned",
    name: "Total Earned",
    description: "Totaalbedrag aan verkopen (€)",
    category: "TRADER",
    sortOrder: 31,
    tiers: [
      { tier: 1, threshold: 100,   rewardEmber: 50 },
      { tier: 2, threshold: 1000,  rewardEmber: 300 },
      { tier: 3, threshold: 5000,  rewardEmber: 1000 },
      { tier: 4, threshold: 25000, rewardEmber: 2500, rewardXP: 1000 },
      { tier: 5, threshold: 50000, rewardEmber: 5000, rewardXP: 2000 },
    ],
  },
  {
    key: "reviews-given",
    name: "Reviews Given",
    description: "Aantal reviews dat je geschreven hebt",
    category: "SOCIAL",
    sortOrder: 40,
    tiers: [
      { tier: 1, threshold: 1,   rewardEmber: 15 },
      { tier: 2, threshold: 10,  rewardEmber: 75 },
      { tier: 3, threshold: 25,  rewardEmber: 200 },
      { tier: 4, threshold: 50,  rewardEmber: 400 },
      { tier: 5, threshold: 100, rewardEmber: 800, rewardXP: 250 },
    ],
  },
  {
    key: "five-stars-received",
    name: "Five-Star Reviews Received",
    description: "Aantal 5-sterren reviews die je hebt ontvangen",
    category: "SOCIAL",
    sortOrder: 41,
    tiers: [
      { tier: 1, threshold: 1,  rewardEmber: 25 },
      { tier: 2, threshold: 10, rewardEmber: 150 },
      { tier: 3, threshold: 25, rewardEmber: 400 },
      { tier: 4, threshold: 50, rewardEmber: 800, rewardXP: 250 },
      { tier: 5, threshold: 100,rewardEmber: 1500, rewardXP: 500 },
    ],
  },
  {
    key: "login-streak",
    name: "Login Streak",
    description: "Aaneengesloten dagen ingelogd",
    category: "MILESTONE",
    sortOrder: 50,
    tiers: [
      { tier: 1, threshold: 3,  rewardEmber: 25 },
      { tier: 2, threshold: 7,  rewardEmber: 75 },
      { tier: 3, threshold: 14, rewardEmber: 200 },
      { tier: 4, threshold: 21, rewardEmber: 350 },
      { tier: 5, threshold: 28, rewardEmber: 750, rewardXP: 250 },
    ],
  },
  {
    key: "founder-member",
    name: "Founder",
    description: "Account aangemaakt voor de officiële launch",
    category: "FOUNDER",
    sortOrder: 60,
    tiers: [
      { tier: 1, threshold: 1, rewardEmber: 500, rewardXP: 500 },
    ],
  },
];

async function main() {
  console.log("🏆 Seeding tiered achievement catalog...");

  for (const def of ACHIEVEMENTS) {
    await prisma.achievement.upsert({
      where: { key: def.key },
      create: {
        key: def.key,
        name: def.name,
        description: def.description,
        category: def.category,
        sortOrder: def.sortOrder,
      },
      update: {
        name: def.name,
        description: def.description,
        category: def.category,
        sortOrder: def.sortOrder,
      },
    });

    // Replace tiers for this achievement.
    await prisma.achievementTier.deleteMany({
      where: { achievementKey: def.key },
    });
    for (const t of def.tiers) {
      await prisma.achievementTier.create({
        data: {
          achievementKey: def.key,
          tier: t.tier,
          threshold: t.threshold,
          rewardEmber: t.rewardEmber ?? null,
          rewardXP: t.rewardXP ?? null,
          rewardCosmeticKey: t.rewardCosmeticKey ?? null,
        },
      });
    }
  }

  const totalTiers = ACHIEVEMENTS.reduce((s, a) => s + a.tiers.length, 0);
  console.log(`✅ ${ACHIEVEMENTS.length} achievements with ${totalTiers} tiers upserted.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
